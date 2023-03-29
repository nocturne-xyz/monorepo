import { Wallet, Wallet__factory } from "@nocturne-xyz/contracts";
import { OperationProcessedEvent } from "@nocturne-xyz/contracts/dist/src/Wallet";
import {
  Address,
  computeOperationDigest,
  ProvenOperation,
  OperationStatus,
  parseEventsFromContractReceipt,
} from "@nocturne-xyz/sdk";
import { Job, Worker } from "bullmq";
import IORedis from "ioredis";
import { ethers } from "ethers";
import { OPERATION_BATCH_QUEUE, OperationBatchJobData } from "./common";
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
    signingProvider: ethers.Signer,
    redis: IORedis
  ) {
    this.redis = redis;
    this.statusDB = new StatusDB(this.redis);
    this.signingProvider = signingProvider;
    this.walletContract = Wallet__factory.connect(
      walletAddress,
      this.signingProvider
    );
  }

  start(): [Promise<void>, () => Promise<void>] {
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
      { connection: this.redis, autorun: true }
    );

    console.log(
      `Submitter running. Wallet contract: ${this.walletContract.address}.`
    );

    const prom = new Promise<void>((resolve, _reject) => {
      worker.on("closed", () => {
        console.log("[BUNDLER-SUBMITTER TEARDOWN] worker closed");
        resolve();
      });
    });

    return [
      prom,
      async () => {
        console.log("[BUNDLER-SUBMITTER TEARDOWN] await worker.close()");
        await worker.close();
        console.log("[BUNDLER-SUBMITTER TEARDOWN] await prom");
        await prom;
        console.log("[BUNDLER-SUBMITTER TEARDOWN] done");
      },
    ];
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
