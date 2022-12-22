import { Queue } from "bullmq";
import IORedis from "ioredis";
import {
  OperationStatus,
  ProvenOperationJobData,
  PROVEN_OPERATION_QUEUE,
  PROVEN_OPERATION_JOB_TAG,
} from "./common";
import { Request, Response } from "express";
import { calculateOperationDigest, ProvenOperation } from "@nocturne-xyz/sdk";
import { OperationValidator } from "./validator";
import * as JSON from "bigint-json-serialization";
import { StatusDB } from "./db";
import { getRedis } from "./utils";
import { ethers } from "ethers";
import { tryParseRelayRequest } from "./requestValidation";

export class BundlerRouter {
  redis: IORedis;
  queue: Queue<ProvenOperationJobData>;
  validator: OperationValidator;
  statusDB: StatusDB;

  constructor(
    walletAddress: string,
    redis?: IORedis,
    provider?: ethers.providers.Provider
  ) {
    this.redis = getRedis(redis);
    this.queue = new Queue(PROVEN_OPERATION_QUEUE, { connection: this.redis });
    this.statusDB = new StatusDB(this.redis);
    this.validator = new OperationValidator(
      walletAddress,
      this.redis,
      provider
    );
  }

  async handleRelay(req: Request, res: Response): Promise<void> {
    console.log("Validating request");
    const errorOrOperation = tryParseRelayRequest(req.body);
    if (typeof errorOrOperation == "string") {
      res.statusMessage = errorOrOperation;
      res.status(400).json(errorOrOperation);
      return;
    }

    console.log("Validating nullifiers");
    const operation = errorOrOperation;
    const nfConflictErr = await this.validator.extractNullifierConflictError(
      operation
    );
    if (nfConflictErr) {
      res.status(400).json(nfConflictErr);
      return;
    }

    console.log("Validating reverts");
    const revertErr = await this.validator.extractRevertError(operation);
    if (revertErr) {
      res.status(400).json(revertErr);
      return;
    }

    // Enqueue operation and add all inflight nullifiers
    const jobId = await this.postJob(operation);
    res.json({ id: jobId });
  }

  async handleGetOperationStatus(req: Request, res: Response): Promise<void> {
    const status = await this.statusDB.getJobStatus(req.params.id);
    if (status) {
      res.json(status);
    } else {
      res.status(400).json({ error: "Job doesn't exist" });
    }
  }

  private async postJob(operation: ProvenOperation): Promise<string> {
    const jobId = calculateOperationDigest(operation).toString();
    const operationJson = JSON.stringify(operation);
    const jobData: ProvenOperationJobData = {
      operationJson,
    };

    // TODO: race condition between queue.add and redis transaction
    await this.queue.add(PROVEN_OPERATION_JOB_TAG, jobData, {
      jobId,
    });

    const setJobStatusTransaction = this.statusDB.getSetJobStatusTransaction(
      jobId,
      OperationStatus.QUEUED
    );
    const addNfsTransaction =
      this.validator.nullifierDB.getAddNullifierTransactions(operation);
    const allTransactions = addNfsTransaction.concat([setJobStatusTransaction]);
    await this.redis.multi(allTransactions).exec((maybeErr) => {
      if (maybeErr) {
        throw new Error(
          `Failed to execute set jobs status + add nfs transaction: ${maybeErr}`
        );
      }
    });
    return jobId;
  }
}
