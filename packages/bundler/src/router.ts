import { Queue } from "bullmq";
import IORedis from "ioredis";
import { PROVEN_OPERATIONS_QUEUE } from "./common";
import { Request, Response } from "express";
import { extractRequestError } from "./utils";
import { provenOperationFromJSON } from "@nocturne-xyz/sdk";

export class BundlerRouter {
  queue: Queue;

  constructor() {
    const redisUrl = process.env.REDIS_URL ?? "redis://redis:6379";
    const connection = new IORedis(redisUrl);
    this.queue = new Queue(PROVEN_OPERATIONS_QUEUE, { connection });
  }

  async handleRelay(req: Request, res: Response): Promise<void> {
    const maybeRequestError = extractRequestError(
      req.body,
      provenOperationFromJSON
    );
    if (maybeRequestError) {
      res.status(400).json({ error: maybeRequestError });
      return;
    }
  }
}
