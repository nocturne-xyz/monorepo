import IORedis from "ioredis";
import express from "express";
import * as os from "os";
import { ethers } from "ethers";
import cors from "cors";
import { Logger } from "winston";
import morgan from "morgan";
import { Queue } from "bullmq";
import { ProvenOperationJobData, PROVEN_OPERATION_QUEUE } from "./common";
import { NullifierDB, StatusDB } from "./db";
import { Wallet, Wallet__factory } from "@nocturne-xyz/contracts";
import { makeGetOperationStatusHandler, makeRelayHandler } from "./routes";

export class BundlerServer {
  redis: IORedis;
  queue: Queue<ProvenOperationJobData>;
  statusDB: StatusDB;
  nullifierDB: NullifierDB;
  logger: Logger;
  walletContract: Wallet;
  provider: ethers.providers.Provider;
  ignoreGas?: boolean;

  constructor(
    walletAddress: string,
    provider: ethers.providers.Provider,
    redis: IORedis,
    logger: Logger,
    ignoreGas?: boolean
  ) {
    this.redis = redis;
    this.queue = new Queue(PROVEN_OPERATION_QUEUE, { connection: redis });
    this.statusDB = new StatusDB(redis);
    this.nullifierDB = new NullifierDB(redis);
    this.logger = logger;
    this.provider = provider;
    this.walletContract = Wallet__factory.connect(walletAddress, provider);
    this.ignoreGas = ignoreGas;
  }

  start(port: number): () => Promise<void> {
    const router = express.Router();
    router.post(
      "/relay",
      makeRelayHandler({
        queue: this.queue,
        statusDB: this.statusDB,
        nullifierDB: this.nullifierDB,
        redis: this.redis,
        walletContract: this.walletContract,
        provider: this.provider,
        logger: this.logger.child({
          route: "/relay",
          function: "relayHandler",
        }),
        opts: { ignoreGas: this.ignoreGas },
      })
    );

    router.get(
      "/operations/:id",
      makeGetOperationStatusHandler({
        statusDB: this.statusDB,
        logger: this.logger.child({
          route: "/operations/:id",
          function: "getOperationStatusHandler",
        }),
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
