import IORedis from "ioredis";
import express from "express";
import * as os from "os";
import cors from "cors";
import { Logger } from "winston";
import morgan from "morgan";
import { Queue } from "bullmq";
import {
  DepositRequestJobData,
  SCREENER_DELAY_QUEUE,
  getFulfillmentQueueName,
} from "./types";
import { DepositScreenerDB } from "./db";
import { WaitEstimator } from "./waitEstimation";
import { Address } from "@nocturne-xyz/sdk";
import { QueueWaitEstimator } from "./waitEstimation/queue";
import { makeDepositStatusHandler } from "./routes";

export interface TickerAndRateLimit {
  ticker: Address;
  rateLimit: bigint;
}

export class DepositScreenerServer {
  redis: IORedis;
  logger: Logger;
  db: DepositScreenerDB;
  screenerQueue: Queue<DepositRequestJobData>;
  fulfillerQueues: Map<Address, Queue<DepositRequestJobData>>;
  waitEstimator: WaitEstimator;

  constructor(
    redis: IORedis,
    logger: Logger,
    supportedAssetRateLimits: Map<Address, TickerAndRateLimit>
  ) {
    this.redis = redis;
    this.logger = logger;
    this.db = new DepositScreenerDB(redis);
    this.screenerQueue = new Queue(SCREENER_DELAY_QUEUE, { connection: redis });
    this.fulfillerQueues = new Map(
      Array.from(supportedAssetRateLimits.values()).map(({ ticker }) => {
        return [
          ticker,
          new Queue(getFulfillmentQueueName(ticker), { connection: redis }),
        ];
      })
    );

    const rateLimits = new Map(
      Array.from(supportedAssetRateLimits.entries()).map(
        ([address, { rateLimit }]) => [address, rateLimit]
      )
    );
    this.waitEstimator = new QueueWaitEstimator(
      this.screenerQueue,
      this.fulfillerQueues,
      rateLimits
    );
  }

  start(port: number): () => Promise<void> {
    const router = express.Router();

    router.get(
      "/status/:depositHash",
      makeDepositStatusHandler({
        logger: this.logger,
        db: this.db,
        waitEstimator: this.waitEstimator,
        screenerQueue: this.screenerQueue,
        fulfillerQueues: this.fulfillerQueues,
      })
    );

    const app = express();

    const logMiddleware = morgan(
      ":method :url :status :res[content-length] - :response-time ms",
      {
        stream: {
          // Configure Morgan to use our custom logger with the http severity
          write: (message) => this.logger.http(message.trim()),
        },
      }
    );

    app.use(logMiddleware);
    app.use(cors());
    app.use(express.json());
    app.use(router);

    const server = app.listen(port, () => {
      this.logger.info(`listening at ${os.hostname()}:${port}`);
    });

    return () =>
      new Promise((resolve) => {
        server.close(() => {
          this.logger.info("closed");
          resolve();
        });
      });
  }
}
