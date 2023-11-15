import { Address } from "@nocturne-xyz/core";
import {
  ActorHandle,
  HealthCheckResponse,
  geoMiddleware,
} from "@nocturne-xyz/offchain-utils";
import { Queue } from "bullmq";
import cors from "cors";
import express from "express";
import IORedis from "ioredis";
import morgan from "morgan";
import * as os from "os";
import { Logger } from "winston";
import { DepositScreenerDB } from "./db";
import { makeDepositStatusHandler, makeQuoteHandler } from "./routes";
import { ScreeningCheckerApi } from "./screening";
import {
  DepositEventJobData,
  SCREENER_DELAY_QUEUE,
  getFulfillmentQueueName,
} from "./types";
import { Knex } from "knex";

export class DepositScreenerServer {
  logger: Logger;
  redis: IORedis;
  pool: Knex;
  db: DepositScreenerDB;
  screeningApi: ScreeningCheckerApi;
  screenerQueue: Queue<DepositEventJobData>;
  fulfillerQueues: Map<Address, Queue<DepositEventJobData>>;
  supportedAssetRateLimits: Map<Address, bigint>;

  constructor(
    logger: Logger,
    redis: IORedis,
    pool: Knex,
    screeningApi: ScreeningCheckerApi,
    supportedAssetRateLimits: Map<Address, bigint>
  ) {
    this.logger = logger;
    this.redis = redis;
    this.db = new DepositScreenerDB(redis);
    this.pool = pool;
    this.screeningApi = screeningApi;
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

  start(port: number): ActorHandle {
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

    router.post(
      "/quote",
      makeQuoteHandler({
        logger: this.logger,
        screeningApi: this.screeningApi,
        screenerQueue: this.screenerQueue,
        fulfillerQueues: this.fulfillerQueues,
        rateLimits: this.supportedAssetRateLimits,
      })
    );

    // health check
    router.get("/", async (_req, res, _next) => {
      const healthCheck: HealthCheckResponse = {
        uptime: process.uptime(),
        message: "OK",
        timestamp: Date.now(),
      };
      res.send(healthCheck);
    });

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
    app.use(geoMiddleware({ logger: this.logger, pool: this.pool }));
    app.use(router);

    const server = app.listen(port, () => {
      this.logger.info(`listening at ${os.hostname()}:${port}`);
    });

    const promise = new Promise<void>((resolve, reject) => {
      server.on("close", () => {
        this.logger.info("server closed");
        resolve();
      });

      server.on("error", (err) => {
        this.logger.error("server error", { err });
        reject();
      });

      // TODO: any other stuff we should listen to here?
    });

    const teardown = () =>
      new Promise<void>((resolve) => {
        server.close(() => {
          this.logger.info("closed");
          resolve();
        });
      });

    return {
      promise,
      teardown,
    };
  }
}
