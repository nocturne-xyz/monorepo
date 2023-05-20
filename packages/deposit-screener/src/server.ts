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
import { Address } from "@nocturne-xyz/sdk";
import { makeDepositStatusHandler, makeQuoteHandler } from "./routes";
import { ScreenerDelayCalculator } from "./screenerDelay";
import { ScreeningApi } from "./screening";

export class DepositScreenerServer {
  logger: Logger;
  redis: IORedis;
  db: DepositScreenerDB;
  screeningApi: ScreeningApi;
  screenerDelayCalculator: ScreenerDelayCalculator;
  screenerQueue: Queue<DepositRequestJobData>;
  fulfillerQueues: Map<Address, Queue<DepositRequestJobData>>;
  supportedAssetRateLimits: Map<Address, bigint>;

  constructor(
    logger: Logger,
    redis: IORedis,
    screeningApi: ScreeningApi,
    screenerDelayCalculator: ScreenerDelayCalculator,
    supportedAssetRateLimits: Map<Address, bigint>
  ) {
    this.logger = logger;
    this.redis = redis;
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

    this.supportedAssetRateLimits = supportedAssetRateLimits;
  }

  start(port: number): () => Promise<void> {
    const router = express.Router();

    router.get(
      "/status/:depositHash",
      makeDepositStatusHandler({
        logger: this.logger,
        db: this.db,
        screenerQueue: this.screenerQueue,
        fulfillerQueues: this.fulfillerQueues,
        rateLimits: this.supportedAssetRateLimits,
      })
    );

    router.get(
      "/quote",
      makeQuoteHandler({
        logger: this.logger,
        screeningApi: this.screeningApi,
        screenerDelayCalculator: this.screenerDelayCalculator,
        screenerQueue: this.screenerQueue,
        fulfillerQueues: this.fulfillerQueues,
        rateLimits: this.supportedAssetRateLimits,
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
