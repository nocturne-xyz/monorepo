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
import { NullifierDB, RedisTransaction, StatusDB } from "./db";
import * as JSON from "bigint-json-serialization";

export interface BundlerSubmitterHandle {
  // promise that resolves when the service is done
  promise: Promise<void>;
  // function to teardown the service
  teardown: () => Promise<void>;
}

export class BundlerSubmitter {
  redis: IORedis;
  signingProvider: ethers.Signer;
  walletContract: Wallet; // TODO: replace with tx manager
  statusDB: StatusDB;
  nullifierDB: NullifierDB;

  readonly INTERVAL_SECONDS: number = 60;
  readonly BATCH_SIZE: number = 8;

  constructor(
    walletAddress: Address,
    signingProvider: ethers.Signer,
    redis: IORedis
  ) {
    this.redis = redis;
    this.statusDB = new StatusDB(this.redis);
    this.nullifierDB = new NullifierDB(this.redis);
    this.signingProvider = signingProvider;
    this.walletContract = Wallet__factory.connect(
      walletAddress,
      this.signingProvider
    );
  }

  start(): BundlerSubmitterHandle {
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
      `submitter starting... wallet contract: ${this.walletContract.address}.`
    );

    const promise = new Promise<void>((resolve) => {
      worker.on("closed", () => {
        resolve();
      });
    });

    return {
      promise,
      teardown: async () => {
        await worker.close();
        await promise;
      },
    };
  }

  async submitBatch(operations: ProvenOperation[]): Promise<void> {
    // TODO: this job isn't idempotent. If one step fails, bullmq will re-try
    // which may cause issues. Current plan is to mark reverted bundles as
    // failed. Will circle back after further testing and likely
    // re-queue/re-validate ops in the reverted bundle.

    console.log("setting ops to inflight...");
    await this.setOpsToInflight(operations);

    console.log("dispatching bundle...");
    const tx = await this.dispatchBundle(operations);

    if (!tx) {
      console.log("bundle reverted");
      return;
    }

    console.log("waiting for confirmation...");
    const receipt = await tx.wait(1);

    console.log("performing post-submission bookkeeping");
    await this.performPostSubmissionBookkeeping(operations, receipt);
  }

  async setOpsToInflight(operations: ProvenOperation[]): Promise<void> {
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
          `failed to set job status transactions to inflight: ${maybeErr}`
        );
      }
    });
  }

  async dispatchBundle(
    operations: ProvenOperation[]
  ): Promise<ethers.ContractTransaction | undefined> {
    try {
      console.log("num operations:", operations.length);
      return this.walletContract.processBundle(
        { operations },
        { gasLimit: 1_000_000 } // Hardcode gas limit to skip eth_estimateGas
      );
    } catch (err) {
      console.log("failed to process bundle:", err);
      const redisTxs = operations.flatMap((op) => {
        const digest = computeOperationDigest(op);
        console.log(
          `setting operation with digest ${digest} to BUNDLE_REVERTED`
        );
        const statusTx = this.statusDB.getSetJobStatusTransaction(
          digest.toString(),
          OperationStatus.BUNDLE_REVERTED
        );

        const nullifierTx = this.nullifierDB.getRemoveNullifierTransactions(op);

        return [statusTx, nullifierTx];
      });

      await this.redis.multi(redisTxs).exec((maybeErr) => {
        if (maybeErr) {
          throw new Error(
            `failed to set job statuses and/or remove nullifiers after bundle reverted: ${maybeErr}`
          );
        }
      });
      return undefined;
    }
  }

  async performPostSubmissionBookkeeping(
    operations: ProvenOperation[],
    receipt: ethers.ContractReceipt
  ): Promise<void> {
    const digestsToOps = new Map(
      operations.map((op) => [computeOperationDigest(op), op])
    );

    const matchingEvents = parseEventsFromContractReceipt(
      receipt,
      this.walletContract.interface.getEvent("OperationProcessed")
    ) as OperationProcessedEvent[];

    console.log("matching events:", matchingEvents);

    const redisTxs = matchingEvents.flatMap(({ args }) => {
      const digest = args.operationDigest.toBigInt();

      const callSuccesses = args.callSuccesses.reduce(
        (acc, success) => acc && success
      );

      let status: OperationStatus;
      if (!args.assetsUnwrapped) {
        status = OperationStatus.OPERATION_PROCESSING_FAILED;
      } else if (!callSuccesses) {
        status = OperationStatus.OPERATION_EXECUTION_FAILED;
      } else {
        status = OperationStatus.EXECUTED_SUCCESS;
      }

      console.log(
        `setting operation with digest ${digest} to status ${status}`
      );

      const redisTxs: RedisTransaction[] = [];
      redisTxs.push(
        this.statusDB.getSetJobStatusTransaction(digest.toString(), status)
      );

      if (status == OperationStatus.OPERATION_PROCESSING_FAILED) {
        console.log(
          `op with digest ${args.operationDigest.toBigInt()} failed during processing, removing nfs`
        );
        const op = digestsToOps.get(args.operationDigest.toBigInt())!;
        redisTxs.push(...this.nullifierDB.getRemoveNullifierTransactions(op));
      }
      return redisTxs;
    });

    await this.redis.multi(redisTxs).exec((maybeErr) => {
      if (maybeErr) {
        throw new Error(
          `failed to set job status transactions + potential NF removals after bundle executed: ${maybeErr}`
        );
      }
    });
  }
}
