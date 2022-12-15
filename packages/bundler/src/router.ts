import { Queue } from "bullmq";
import IORedis from "ioredis";
import {
  OperationStatus,
  PROVEN_OPERATIONS_QUEUE,
  RelayJobData,
} from "./common";
import { Request, Response } from "express";
import { extractRelayError } from "./validation";
import { ProvenOperation } from "@nocturne-xyz/sdk";
import { OperationValidator } from "./validator";
import { randomUUID } from "crypto";
import { assert } from "console";
import * as JSON from "bigint-json-serialization";

const RELAY_JOB_TYPE = "RELAY";

export class RequestRouter {
  queue: Queue<RelayJobData>;
  validator: OperationValidator;

  constructor() {
    const redisUrl = process.env.REDIS_URL ?? "redis://redis:6379";
    const rpcUrl = process.env.RPC_URL;
    if (!rpcUrl) {
      throw new Error("Missing RPC_URL");
    }

    const connection = new IORedis(redisUrl);
    this.queue = new Queue(PROVEN_OPERATIONS_QUEUE, { connection });

    // TODO: separate DB than queue?
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
    const status = await this.getOperationStatus(req.params.id);
    if (status) {
      res.json(status);
    } else {
      res.status(400).json({ error: "Job doesn't exist" });
    }
  }

  private async postJob(operation: ProvenOperation): Promise<string> {
    const jobId = randomUUID();
    const operationJson = JSON.stringify(operation);
    const jobData: RelayJobData = {
      status: OperationStatus.QUEUED,
      operationJson,
    };

    const job = await this.queue.add(RELAY_JOB_TYPE, jobData, {
      jobId,
    });
    assert(job.id == jobId); // TODO: can remove?

    await this.validator.addNullifiers(operation, jobId);
    return jobId;
  }

  private async getOperationStatus(
    id: string
  ): Promise<OperationStatus | undefined> {
    const job = await this.queue.getJob(id);
    if (!job) {
      return undefined;
    }

    return job.data.status;
  }
}
