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
import { makeDepositStatusHandler, makeQuoteHandler } from "./routes";
import { ScreenerDelayCalculator } from "./screenerDelay";
import { ScreeningApi } from "./screening";

export interface TickerAndRateLimit {
  ticker: Address;
  rateLimit: bigint;
}

export class DepositScreenerServer {
  redis: IORedis;
  logger: Logger;
  db: DepositScreenerDB;
  screeningApi: ScreeningApi;
  screenerDelayCalculator: ScreenerDelayCalculator;
  screenerQueue: Queue<DepositRequestJobData>;
  fulfillerQueues: Map<Address, Queue<DepositRequestJobData>>;
  waitEstimator: WaitEstimator;
  supportedAssets: Set<Address>;

  constructor(
    redis: IORedis,
    logger: Logger,
    screeningApi: ScreeningApi,
    screenerDelayCalculator: ScreenerDelayCalculator,
    supportedAssetRateLimits: Map<Address, bigint>
  ) {
    this.redis = redis;
    this.logger = logger;
    this.db = new DepositScreenerDB(redis);
    this.screeningApi = screeningApi;
    this.screenerDelayCalculator = screenerDelayCalculator;
    this.screenerQueue = new Queue(SCREENER_DELAY_QUEUE, { connection: redis });
    this.fulfillerQueues = new Map(
      Array.from(supportedAssetRateLimits.keys()).map((address) => {
        return [
          address,
          new Queue(getFulfillmentQueueName(address), { connection: redis }),
        ];
      })
    );

    this.waitEstimator = new QueueWaitEstimator(
      this.screenerQueue,
      this.fulfillerQueues,
      supportedAssetRateLimits
    );

    this.supportedAssets = new Set(Array.from(supportedAssetRateLimits.keys()));
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

    router.get(
      "/quote",
      makeQuoteHandler({
        logger: this.logger,
        screeningApi: this.screeningApi,
        screenerDelayCalculator: this.screenerDelayCalculator,
        waitEstimator: this.waitEstimator,
        supportedAssets: this.supportedAssets,
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
