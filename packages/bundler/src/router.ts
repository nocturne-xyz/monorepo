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
import { extractRelayError } from "./validation";
import { assert } from "console";
import * as JSON from "bigint-json-serialization";
import { StatusDB } from "./db";
import { getRedis } from "./utils";

export class BundlerRouter {
  queue: Queue<ProvenOperationJobData>;
  validator: OperationValidator;
  statusDB: StatusDB;

  constructor(walletAddress: string, redis?: IORedis) {
    const connection = getRedis(redis);
    this.queue = new Queue(PROVEN_OPERATION_QUEUE, { connection });
    this.statusDB = new StatusDB(connection);
    this.validator = new OperationValidator(walletAddress, connection);
  }

  async handleRelay(req: Request, res: Response): Promise<void> {
    console.log("Validating request");
    const maybeRequestError = extractRelayError(req.body);
    if (maybeRequestError) {
      res.statusMessage = maybeRequestError;
      res.status(400).json(maybeRequestError);
      return;
    }

    console.log("Validating nullifiers");
    const operation = JSON.parse(JSON.stringify(req.body)) as ProvenOperation;
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

    const job = await this.queue.add(PROVEN_OPERATION_JOB_TAG, jobData, {
      jobId,
    });
    assert(job.id == jobId); // TODO: can remove?

    await this.statusDB.setJobStatus(jobId, OperationStatus.QUEUED);
    await this.validator.addNullifiers(operation, jobId);
    return jobId;
  }
}
