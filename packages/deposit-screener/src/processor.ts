import {
  DepositManager,
  DepositManager__factory,
} from "@nocturne-xyz/contracts";
import {
  Address,
  ClosableAsyncIterator,
  DepositRequest,
  parseEventsFromContractReceipt,
} from "@nocturne-xyz/sdk";
import { Job, Queue, Worker } from "bullmq";
import { ethers } from "ethers";
import { checkDepositRequest } from "./check";
import { DepositScreenerDB } from "./db";
import { DummyScreeningApi, ScreeningApi } from "./screening";
import { DepositEventsBatch, ScreenerSyncAdapter } from "./sync/syncAdapter";
import {
  DepositEventType,
  DepositRequestStatus,
  DELAYED_DEPOSIT_QUEUE,
  DelayedDepositJobData,
  DELAYED_DEPOSIT_JOB_TAG,
} from "./types";
import IORedis from "ioredis";
import { DelayCalculator, DummyDelayCalculator } from "./delay";
import {
  EIP712Domain,
  hashDepositRequest,
  signDepositRequest,
} from "./typedData";
import {
  DEPOSIT_MANAGER_CONTRACT_NAME,
  DEPOSIT_MANAGER_CONTRACT_VERSION,
} from "./typedData/constants";
import { DepositCompletedEvent } from "@nocturne-xyz/contracts/dist/src/DepositManager";
import * as JSON from "bigint-json-serialization";
import { secsToMillis } from "./utils";
import { TypedDataSigner } from "@ethersproject/abstract-signer"; // TODO: replace with ethers post update

export interface DepositScreenerProcessorHandle {
  // promise that resolves when the service is done
  promise: Promise<void>;
  // function to teardown the service
  teardown: () => Promise<void>;
}

export class DepositScreenerProcessor {
  adapter: ScreenerSyncAdapter;
  depositManagerContract: DepositManager;
  screeningApi: ScreeningApi;
  delayCalculator: DelayCalculator;
  delayQueue: Queue;
  db: DepositScreenerDB;
  redis: IORedis;
  attestationSigner: TypedDataSigner;
  txSigner: ethers.Wallet;

  constructor(
    syncAdapter: ScreenerSyncAdapter,
    depositManagerAddress: Address,
    attestationSigner: TypedDataSigner,
    txSigner: ethers.Wallet,
    redis: IORedis
  ) {
    this.redis = redis;
    this.adapter = syncAdapter;

    this.attestationSigner = attestationSigner;
    this.txSigner = txSigner;

    this.depositManagerContract = DepositManager__factory.connect(
      depositManagerAddress,
      txSigner
    );

    this.db = new DepositScreenerDB(redis);
    this.delayQueue = new Queue(DELAYED_DEPOSIT_QUEUE, { connection: redis });

    this.screeningApi = new DummyScreeningApi();
    this.delayCalculator = new DummyDelayCalculator();
  }

  async start(): Promise<DepositScreenerProcessorHandle> {
    const nextBlockToSync = await this.db.getNextBlock();
    console.log(
      `processing deposit requests starting from block ${nextBlockToSync}`
    );

    const depositEvents = this.adapter.iterDepositEvents(
      DepositEventType.Instantiated,
      nextBlockToSync,
      { maxChunkSize: 10_000 }
    );

    const screenerProm = this.runScreener(depositEvents).catch((err) => {
      console.error("error in deposit processor screener: ", err);
      throw new Error("error in deposit processor screener: " + err);
    });

    console.log("starting submitter...");
    console.log(
      `DepositManager contract: ${this.depositManagerContract.address}.`
    );
    const submitter = this.startSubmitter();

    const submitterProm = new Promise<void>((resolve) => {
      submitter.on("closed", () => {
        resolve();
      });
    });

    return {
      promise: (async () => {
        await Promise.all([screenerProm, submitterProm]);
      })(),
      teardown: async () => {
        await depositEvents.close();
        await screenerProm;
        await submitter.close();
        await submitterProm;
      },
    };
  }

  async runScreener(
    depositEvents: ClosableAsyncIterator<DepositEventsBatch>
  ): Promise<void> {
    for await (const batch of depositEvents.iter) {
      for (const event of batch.depositEvents) {
        console.log(`received deposit events: ${JSON.stringify(event)}`);
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
      await this.enqueueDepositRequest(depositRequest);
      return DepositRequestStatus.Enqueued;
    } else {
      return status;
    }
  }

  async enqueueDepositRequest(
    depositRequest: DepositRequest
  ): Promise<DepositRequestStatus> {
    const delaySeconds = await this.delayCalculator.calculateDelaySeconds(
      depositRequest
    );

    const depositRequestJson = JSON.stringify(depositRequest);
    const jobData: DelayedDepositJobData = {
      depositRequestJson,
    };

    await this.delayQueue.add(DELAYED_DEPOSIT_JOB_TAG, jobData, {
      delay: secsToMillis(delaySeconds),
      // if the job fails, re-try it at most 5x with exponential backoff (1s, 2s, 4s)
      attempts: 5,
      backoff: {
        type: "exponential",
        delay: 1000,
      },
    });
    return DepositRequestStatus.Enqueued;
  }

  startSubmitter(): Worker<DelayedDepositJobData, any, string> {
    return new Worker(
      DELAYED_DEPOSIT_QUEUE,
      async (job: Job<DelayedDepositJobData>) => {
        const depositRequest: DepositRequest = JSON.parse(
          job.data.depositRequestJson
        );

        const hash = hashDepositRequest(depositRequest);
        console.log("hash of deposit request post-queue:", hash);
        const inSet =
          await this.depositManagerContract._outstandingDepositHashes(hash);
        if (!inSet) {
          console.log(
            `deposit already retrieved or completed. ${JSON.stringify(
              depositRequest
            )}`
          );
          return; // Already retrieved or completed
        }

        const valid = await this.screeningApi.validDepositRequest(
          depositRequest
        );
        if (!valid) {
          console.log(
            `deposit no longer passes screening. ${JSON.stringify(
              depositRequest
            )}`
          );
          return;
        }

        await this.signAndSubmitDeposit(depositRequest).catch((e) => {
          console.error(e);
          throw new Error(e);
        });
      },
      { connection: this.redis, autorun: true }
    );
  }

  async signAndSubmitDeposit(depositRequest: DepositRequest): Promise<void> {
    const domain: EIP712Domain = {
      name: DEPOSIT_MANAGER_CONTRACT_NAME,
      version: DEPOSIT_MANAGER_CONTRACT_VERSION,
      // TODO: fetch from config instead
      chainId: BigInt(await this.txSigner.getChainId()),
      verifyingContract: this.depositManagerContract.address,
    };

    console.log("signing deposit request:", JSON.stringify(depositRequest));
    const signature = await signDepositRequest(
      this.attestationSigner,
      domain,
      depositRequest
    );

    console.log("submitting completeDeposit tx...");
    const tx = await this.depositManagerContract
      .completeDeposit(depositRequest, signature)
      .catch((e) => {
        console.error(e);
        throw new Error(e);
      });

    console.log("waiting for receipt...");
    const receipt = await tx.wait(1);
    console.log("completeDeposit receipt:", receipt);

    const matchingEvents = parseEventsFromContractReceipt(
      receipt,
      this.depositManagerContract.interface.getEvent("DepositCompleted")
    ) as DepositCompletedEvent[];
    console.log("matching events:", matchingEvents);

    if (matchingEvents.length > 0) {
      console.log(
        `deposit signed and submitted. Spender: ${depositRequest.spender}. Nonce: ${depositRequest.nonce}`
      );
      await this.db.setDepositRequestStatus(
        depositRequest,
        DepositRequestStatus.Completed
      );
    } else {
      // NOTE: not sure if possible that tx submission passes but event not found
      console.error(
        `deposit request failed. Spender: ${depositRequest.spender}. Nonce: ${depositRequest.nonce}`
      );
    }
  }
}
