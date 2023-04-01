import { Queue } from "bullmq";
import IORedis from "ioredis";
import {
  ProvenOperationJobData,
  PROVEN_OPERATION_QUEUE,
  PROVEN_OPERATION_JOB_TAG,
} from "./common";
import { Request, Response } from "express";
import {
  OperationStatus,
  computeOperationDigest,
  ProvenOperation,
} from "@nocturne-xyz/sdk";
import { OperationValidator } from "./validator";
import * as JSON from "bigint-json-serialization";
import { StatusDB } from "./db";
import { ethers } from "ethers";
import { tryParseRelayRequest } from "./requestValidation";

export class BundlerRouter {
  redis: IORedis;
  queue: Queue<ProvenOperationJobData>;
  validator: OperationValidator;
  statusDB: StatusDB;

  constructor(
    walletAddress: string,
    provider: ethers.providers.Provider,
    redis: IORedis,
    ignoreGas?: boolean
  ) {
    this.redis = redis;
    this.queue = new Queue(PROVEN_OPERATION_QUEUE, { connection: redis });
    this.statusDB = new StatusDB(redis);
    this.validator = new OperationValidator(
      walletAddress,
      provider,
      redis,
      ignoreGas
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

    const operation = errorOrOperation;

    console.log("checking operation's gas price");
    const gasPriceErr = await this.validator.checkNotEnoughGasError(operation);
    if (gasPriceErr) {
      res.status(400).json(gasPriceErr);
    }

    console.log("validating nullifiers");
    const nfConflictErr = await this.validator.checkNullifierConflictError(
      operation
    );
    if (nfConflictErr) {
      res.status(400).json(nfConflictErr);
      return;
    }

    console.log("validating reverts");
    const revertErr = await this.validator.checkRevertError(operation);
    if (revertErr) {
      res.status(400).json(revertErr);
      return;
    }

    // Enqueue operation and add all inflight nullifiers
    const jobId = await this.postJob(operation).catch((err) => {
      console.error("error posting job", err);
      res.status(500).json({ error: "failed to enqueue operation" });
    });

    res.json({ id: jobId });
  }

  async handleGetOperationStatus(req: Request, res: Response): Promise<void> {
    const status = await this.statusDB.getJobStatus(req.params.id);
    if (status) {
      res.json({ status });
    } else {
      res.status(404).json({ error: "operation not found" });
    }
  }

  private async postJob(operation: ProvenOperation): Promise<string> {
    const jobId = computeOperationDigest(operation).toString();
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
          `failed to execute set jobs status + add nfs transaction: ${maybeErr}`
        );
      }
    });
    return jobId;
  }
}
