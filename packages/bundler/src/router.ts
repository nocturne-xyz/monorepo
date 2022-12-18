import { Queue } from "bullmq";
import IORedis from "ioredis";
import {
  OperationStatus,
  PROVEN_OPERATIONS_QUEUE,
  RelayJobData,
  RELAY_JOB_TYPE,
} from "./common";
import { Request, Response } from "express";
import { calculateOperationDigest, ProvenOperation } from "@nocturne-xyz/sdk";
import { OperationValidator } from "./validator";
import { extractRelayError } from "./validation";
import { assert } from "console";
import * as JSON from "bigint-json-serialization";
import { StatusDB } from "./statusdb";
import { getRedis } from "./utils";

export class RequestRouter {
  queue: Queue<RelayJobData>;
  validator: OperationValidator;
  statusDB: StatusDB;

  constructor(redis?: IORedis) {
    const connection = getRedis(redis);
    const rpcUrl = process.env.RPC_URL;
    if (!rpcUrl) {
      throw new Error("Missing RPC_URL");
    }
    this.queue = new Queue(PROVEN_OPERATIONS_QUEUE, { connection });
    this.statusDB = new StatusDB(connection);
    this.validator = new OperationValidator(rpcUrl, connection);
  }

  async handleRelay(req: Request, res: Response): Promise<void> {
    const maybeRequestError = extractRelayError(req.body);
    if (maybeRequestError) {
      res.status(400).json({ error: maybeRequestError });
      return;
    }

    const operation = JSON.parse(req.body) as ProvenOperation;
    const nfConflictErr = await this.validator.extractNullifierConflictError(
      operation
    );
    if (nfConflictErr) {
      res.status(400).json({ error: nfConflictErr });
      return;
    }

    const revertErr = await this.validator.extractRevertError(operation);
    if (revertErr) {
      res.status(400).json({ error: revertErr });
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
    const jobData: RelayJobData = {
      operationJson,
    };

    const job = await this.queue.add(RELAY_JOB_TYPE, jobData, {
      jobId,
    });
    assert(job.id == jobId); // TODO: can remove?

    await this.statusDB.setJobStatus(jobId, OperationStatus.QUEUED);
    await this.validator.addNullifiers(operation, jobId);
    return jobId;
  }
}
