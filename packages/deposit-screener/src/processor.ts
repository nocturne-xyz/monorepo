import {
  DepositManager,
  DepositManager__factory,
} from "@nocturne-xyz/contracts";
import {
  Address,
  DepositRequest,
  parseEventsFromContractReceipt,
} from "@nocturne-xyz/sdk";
import { Job, Queue, Worker } from "bullmq";
import { ethers } from "ethers";
import { checkDepositRequest } from "./check";
import { DepositScreenerDB } from "./db";
import { enqueueDepositRequest } from "./enqueue";
import { DummyScreeningApi, ScreeningApi } from "./screening";
import { ScreenerSyncAdapter } from "./sync/syncAdapter";
import {
  DepositEventType,
  DepositRequestStatus,
  DELAYED_DEPOSIT_QUEUE,
  DelayedDepositJobData,
} from "./types";
import IORedis from "ioredis";
import { DelayCalculator, DummyDelayCalculator } from "./delay";
import {
  EIP712Domain,
  hashDepositRequest,
  signDepositRequest,
} from "./typedData";
import { assert } from "console";
import {
  DEPOSIT_MANAGER_CONTRACT_NAME,
  DEPOSIT_MANAGER_CONTRACT_VERSION,
} from "./typedData/constants";
import { DepositCompletedEvent } from "@nocturne-xyz/contracts/dist/src/DepositManager";

export class DepositScreenerProcessor {
  adapter: ScreenerSyncAdapter;
  depositManagerContract: DepositManager;
  screeningApi: ScreeningApi;
  delayCalculator: DelayCalculator;
  delayQueue: Queue;
  db: DepositScreenerDB;
  redis: IORedis;
  attestationSigner: ethers.Wallet; // ethers.Wallet implements TypedDataSigner
  txSigner: ethers.Wallet;

  constructor(
    syncAdapter: ScreenerSyncAdapter,
    depositManagerAddress: Address,
    attestationSigner: ethers.Wallet,
    txSigner: ethers.Wallet,
    redis: IORedis
  ) {
    this.redis = redis;
    this.adapter = syncAdapter;

    this.attestationSigner = attestationSigner;
    this.txSigner = txSigner;

    this.depositManagerContract = DepositManager__factory.connect(
      depositManagerAddress,
      txSigner.provider
    );

    this.db = new DepositScreenerDB(redis);
    this.delayQueue = new Queue(DELAYED_DEPOSIT_QUEUE, { connection: redis });

    this.screeningApi = new DummyScreeningApi();
    this.delayCalculator = new DummyDelayCalculator();
  }

  async run(): Promise<void> {
    await Promise.all([this.runScreener(), this.runSubmitter()]);
  }

  async runScreener(): Promise<void> {
    const nextBlockToSync = await this.db.getNextBlock();
    console.log(
      `processing deposit requests starting from block ${nextBlockToSync}`
    );

    const depositEvents = this.adapter.iterDepositEvents(
      DepositEventType.Instantiated,
      nextBlockToSync,
      { maxChunkSize: 10_000 }
    );

    for await (const batch of depositEvents.iter) {
      console.log(`Received deposit events, processing: ${batch}`);
      for (const event of batch.depositEvents) {
        const result = await this.handleDepositRequest({ ...event });
        await this.db.setDepositRequestStatus({ ...event }, result);
      }
      await this.db.setNextBlock(batch.blockNumber);
    }
  }

  async handleDepositRequest(
    depositRequest: DepositRequest
  ): Promise<DepositRequestStatus> {
    const status = await checkDepositRequest(depositRequest, { ...this });

    if (status == DepositRequestStatus.PassedScreen) {
      await enqueueDepositRequest(depositRequest, { ...this });
      return DepositRequestStatus.Enqueued;
    } else {
      return status;
    }
  }

  async runSubmitter(): Promise<void> {
    const worker = new Worker(
      DELAYED_DEPOSIT_QUEUE,
      async (job: Job<DelayedDepositJobData>) => {
        const depositRequest: DepositRequest = JSON.parse(
          job.data.depositRequestJson
        );

        const hash = hashDepositRequest(depositRequest);
        const inSet =
          await this.depositManagerContract._outstandingDepositHashes(hash);
        if (!inSet) {
          console.log(
            `Deposit already retrieved or completed. Spender: ${depositRequest.spender}. Nonce: ${depositRequest.nonce}`
          );
          return; // Already retrieved or completed
        }

        const valid = this.screeningApi.validDepositRequest(depositRequest);
        if (!valid) {
          console.log(
            `Deposit no longer passes screening. Spender: ${depositRequest.spender}. Nonce: ${depositRequest.nonce}`
          );
          return;
        }

        await this.signAndSubmitDeposit(depositRequest).catch((e) => {
          throw new Error(e);
        });
      },
      { connection: this.redis, autorun: false }
    );

    console.log(
      `Submitter running. DepositManager contract: ${this.depositManagerContract.address}.`
    );
    await worker.run();
  }

  async signAndSubmitDeposit(depositRequest: DepositRequest): Promise<void> {
    const chainId = BigInt(await this.txSigner.getChainId());
    assert(
      chainId == depositRequest.chainId,
      "connected chainId != deposit.chainId"
    ); // Should never happen?

    const domain: EIP712Domain = {
      name: DEPOSIT_MANAGER_CONTRACT_NAME,
      version: DEPOSIT_MANAGER_CONTRACT_VERSION,
      chainId,
      verifyingContract: this.depositManagerContract.address,
    };
    const signature = await signDepositRequest(
      this.attestationSigner,
      domain,
      depositRequest
    );

    const tx = await this.depositManagerContract.completeDeposit(
      depositRequest,
      signature
    );

    const receipt = await tx.wait(1);
    const matchingEvents = parseEventsFromContractReceipt(
      receipt,
      this.depositManagerContract.interface.getEvent("DepositCompleted")
    ) as DepositCompletedEvent[];
    console.log("Matching events:", matchingEvents);

    if (matchingEvents.length > 0) {
      console.log(
        `Deposit signed and submitted. Spender: ${depositRequest.spender}. Nonce: ${depositRequest.nonce}`
      );
      await this.db.setDepositRequestStatus(
        depositRequest,
        DepositRequestStatus.Completed
      );
    } else {
      // NOTE: not sure if possible that tx submission passes but event not found
      console.error(
        `Deposit request failed. Spender: ${depositRequest.spender}. Nonce: ${depositRequest.nonce}`
      );
    }
  }
}
