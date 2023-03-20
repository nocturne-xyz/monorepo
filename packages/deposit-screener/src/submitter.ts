import {
  DepositManager,
  DepositManager__factory,
} from "@nocturne-xyz/contracts";
import {
  Address,
  DepositRequest,
  parseEventsFromContractReceipt,
} from "@nocturne-xyz/sdk";
import { Job, Worker } from "bullmq";
import { ethers } from "ethers";
import { DepositScreenerDB } from "./db";
import { DummyScreeningApi, ScreeningApi } from "./screening";
import IORedis from "ioredis";
import { getRedis } from "./utils";
import {
  DelayedDepositJobData,
  DELAYED_DEPOSIT_QUEUE,
  DepositRequestStatus,
} from "./types";
import {
  EIP712Domain,
  hashDepositRequest,
  signDepositRequest,
} from "./typedData";
import {
  DEPOSIT_MANAGER_CONTRACT_NAME,
  DEPOSIT_MANAGER_CONTRACT_VERSION,
} from "./typedData/constants";
import { assert } from "console";
import * as JSON from "bigint-json-serialization";
import { DepositCompletedEvent } from "@nocturne-xyz/contracts/dist/src/DepositManager";

export class DepositScreenerSubmitter {
  redis: IORedis;
  depositManagerContract: DepositManager;
  screeningApi: ScreeningApi;
  db: DepositScreenerDB;
  signingProvider: ethers.Wallet; // NOTE: we use wallet because it supports typed data signing

  constructor(
    depositManagerAddress: Address,
    redis?: IORedis,
    signingProvider?: ethers.Wallet
  ) {
    this.redis = getRedis(redis);
    this.db = new DepositScreenerDB(this.redis);

    if (signingProvider) {
      this.signingProvider = signingProvider;
    } else {
      const privateKey = process.env.TX_SIGNER_KEY;
      if (!privateKey) {
        throw new Error("Missing TX_SIGNER_KEY");
      }

      const rpcUrl = process.env.RPC_URL;
      if (!rpcUrl) {
        throw new Error("Missing RPC_URL");
      }
      const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
      this.signingProvider = new ethers.Wallet(privateKey, provider);
    }

    this.depositManagerContract = DepositManager__factory.connect(
      depositManagerAddress,
      this.signingProvider
    );

    this.screeningApi = new DummyScreeningApi();
  }

  async run(): Promise<void> {
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
    const chainId = BigInt(await this.signingProvider.getChainId());
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
      this.signingProvider,
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
