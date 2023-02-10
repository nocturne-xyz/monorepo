import { Wallet, Wallet__factory } from "@nocturne-xyz/contracts";
import { OperationProcessedEvent } from "@nocturne-xyz/contracts/dist/src/Wallet";
import {
  Address,
  computeOperationDigest,
  ProvenOperation,
  OperationStatus,
} from "@nocturne-xyz/sdk";
import { parseEventsFromContractReceipt } from "@nocturne-xyz/sdk/dist/src/sdk/utils/ethers";
import { Job, Worker } from "bullmq";
import IORedis from "ioredis";
import { ethers, providers } from "ethers";
import { OPERATION_BATCH_QUEUE, OperationBatchJobData } from "./common";
import { getRedis } from "./utils";
import { StatusDB } from "./db";
import * as JSON from "bigint-json-serialization";

export class BundlerSubmitter {
  redis: IORedis;
  signingProvider: ethers.Signer;
  walletContract: Wallet; // TODO: replace with tx manager
  statusDB: StatusDB;

  readonly INTERVAL_SECONDS: number = 60;
  readonly BATCH_SIZE: number = 8;

  constructor(
    walletAddress: Address,
    redis?: IORedis,
    signingProvider?: ethers.Signer
  ) {
    const connection = getRedis(redis);
    this.redis = connection;
    this.statusDB = new StatusDB(connection);

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
      const provider = new providers.JsonRpcProvider(rpcUrl);
      this.signingProvider = new ethers.Wallet(privateKey, provider);
    }

    this.walletContract = Wallet__factory.connect(
      walletAddress,
      this.signingProvider
    );
  }

  async run(): Promise<void> {
    const worker = new Worker(
      OPERATION_BATCH_QUEUE,
      async (job: Job<OperationBatchJobData>) => {
        const operations: ProvenOperation[] = JSON.parse(
          job.data.operationBatchJson
        );
        await this.submitBatch(operations).catch((e) => {
          throw new Error(e);
        });
      },
      { connection: this.redis, autorun: false }
    );

    console.log(
      `Submitter running. Wallet contract: ${this.walletContract.address}.`
    );
    await worker.run();
  }

  async submitBatch(operations: ProvenOperation[]): Promise<void> {
    // Loop through current batch and set each job status to IN_FLIGHT
    const inflightStatusTransactions = operations.map((op) => {
      const jobId = computeOperationDigest(op).toString();
      return this.statusDB.getSetJobStatusTransaction(
        jobId,
        OperationStatus.IN_FLIGHT
      );
    });
    await this.redis.multi(inflightStatusTransactions).exec((maybeErr) => {
      if (maybeErr) {
        throw new Error(
          `Failed to set job status transactions to inflight: ${maybeErr}`
        );
      }
    });

    console.log("submitting bundle...");
    // Hardcode gas limit to skip eth_estimateGas
    const tx = await this.walletContract.processBundle(
      { operations },
      { gasLimit: 1_000_000 }
    );
    console.log("waiting for confirmation...");
    const receipt = await tx.wait(1);

    const matchingEvents = parseEventsFromContractReceipt(
      receipt,
      this.walletContract.interface.getEvent("OperationProcessed")
    ) as OperationProcessedEvent[];

    console.log("Matching events:", matchingEvents);

    const executedStatusTransactions = matchingEvents.map(({ args }) => {
      const digest = args.operationDigest.toBigInt();
      const callSuccesses = args.callSuccesses.reduce(
        (acc, success) => acc && success
      );
      const status = callSuccesses
        ? OperationStatus.EXECUTED_SUCCESS
        : OperationStatus.EXECUTED_FAILED;

      console.log(
        `Setting operation with digest ${digest} to status ${status}`
      );
      return this.statusDB.getSetJobStatusTransaction(
        digest.toString(),
        status
      );
    });

    await this.redis.multi(executedStatusTransactions).exec((maybeErr) => {
      if (maybeErr) {
        throw new Error(
          `Failed to set job status transactions post-op: ${maybeErr}`
        );
      }
    });
  }
}
