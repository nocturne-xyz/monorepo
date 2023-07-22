import IORedis from "ioredis";
import express from "express";
import * as os from "os";
import { ethers } from "ethers";
import cors from "cors";
import { Logger } from "winston";
import morgan from "morgan";
import { Queue } from "bullmq";
import {
  OperationJobData,
  SUBMITTABLE_OPERATION_QUEUE,
  ACTOR_NAME,
} from "./types";
import { NullifierDB, StatusDB } from "./db";
import { Teller, Teller__factory } from "@nocturne-xyz/contracts";
import {
  makeCheckNFHandler,
  makeGetOperationStatusHandler,
  makeRelayHandler,
} from "./routes";
import {
  ActorHandle,
  HealthCheckResponse,
  makeCreateCounterFn,
  makeCreateHistogramFn,
} from "@nocturne-xyz/offchain-utils";
import * as ot from "@opentelemetry/api";

const COMPONENT_NAME = "server";

export interface BundlerServerMetrics {
  relayRequestsReceivedCounter: ot.Counter;
  opValidationFailuresHistogram: ot.Histogram;
  relayRequestsEnqueuedCounter: ot.Counter;
}

export class BundlerServer {
  redis: IORedis;
  queue: Queue<OperationJobData>;
  statusDB: StatusDB;
  nullifierDB: NullifierDB;
  logger: Logger;
  tellerContract: Teller;
  provider: ethers.providers.Provider;
  metrics: BundlerServerMetrics;
  ignoreGas?: boolean;

  constructor(
    tellerAddress: string,
    provider: ethers.providers.Provider,
    redis: IORedis,
    logger: Logger,
    ignoreGas?: boolean
  ) {
    this.redis = redis;
    this.queue = new Queue(SUBMITTABLE_OPERATION_QUEUE, { connection: redis });
    this.statusDB = new StatusDB(redis);
    this.nullifierDB = new NullifierDB(redis);
    this.logger = logger;
    this.provider = provider;
    this.tellerContract = Teller__factory.connect(tellerAddress, provider);

    const meter = ot.metrics.getMeter(COMPONENT_NAME);
    const createCounter = makeCreateCounterFn(
      meter,
      ACTOR_NAME,
      COMPONENT_NAME
    );
    const createHistogram = makeCreateHistogramFn(
      meter,
      ACTOR_NAME,
      COMPONENT_NAME
    );

    this.metrics = {
      relayRequestsReceivedCounter: createCounter(
        "relay_requests_received.counter",
        "Number of relay requests received by server"
      ),
      opValidationFailuresHistogram: createHistogram(
        "op_validation_failures.histogram",
        "Histogram of op validation failures"
      ),
      relayRequestsEnqueuedCounter: createCounter(
        "relay_requests_enqueued.counter",
        "Number of relay requests enqueued for batching"
      ),
    };

    this.ignoreGas = ignoreGas;
  }

  start(port: number): ActorHandle {
    const router = express.Router();
    router.post(
      "/relay",
      makeRelayHandler({
        queue: this.queue,
        statusDB: this.statusDB,
        nullifierDB: this.nullifierDB,
        redis: this.redis,
        tellerContract: this.tellerContract,
        provider: this.provider,
        logger: this.logger.child({
          route: "/relay",
          function: "relayHandler",
        }),
        metrics: this.metrics,
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

    router.get(
      "/nullifiers/:nullifier",
      makeCheckNFHandler({
        nullifierDB: this.nullifierDB,
        logger: this.logger.child({
          route: "/nullifiers/:nullifier",
          function: "getNullifierStatusHandler",
        }),
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
