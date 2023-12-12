import IORedis from "ioredis";
import express from "express";
import * as os from "os";
import { ethers } from "ethers";
import cors from "cors";
import { Logger } from "winston";
import morgan from "morgan";
import { ACTOR_NAME } from "./types";
import { BufferDB, NullifierDB, StatusDB } from "./db";
import {
  Handler,
  Handler__factory,
  Teller,
  Teller__factory,
} from "@nocturne-xyz/contracts";
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
import {
  Address,
  SubmittableOperationWithNetworkInfo,
} from "@nocturne-xyz/core";
import { Knex } from "knex";

const COMPONENT_NAME = "server";

export interface BundlerServerMetrics {
  relayRequestsReceivedCounter: ot.Counter;
  opValidationFailuresHistogram: ot.Histogram;
  relayRequestsEnqueuedCounter: ot.Counter;
}

export class BundlerServer {
  redis: IORedis;
  pool: Knex;
  fastBuffer: BufferDB<SubmittableOperationWithNetworkInfo>;
  mediumBuffer: BufferDB<SubmittableOperationWithNetworkInfo>;
  slowBuffer: BufferDB<SubmittableOperationWithNetworkInfo>;
  statusDB: StatusDB;
  nullifierDB: NullifierDB;
  logger: Logger;
  bundlerAddress: Address;
  tellerContract: Teller;
  handlerContract: Handler;
  provider: ethers.providers.Provider;
  metrics: BundlerServerMetrics;
  ignoreGas?: boolean;
  storeRequestInfo?: boolean;

  constructor(
    bundlerAddress: Address,
    tellerAddress: Address,
    handlerAddress: Address,
    provider: ethers.providers.Provider,
    redis: IORedis,
    logger: Logger,
    pool: Knex,
    opts: { storeRequestInfo?: boolean; ignoreGas?: boolean } = {}
  ) {
    this.redis = redis;
    this.pool = pool;
    this.fastBuffer = new BufferDB("FAST", redis);
    this.mediumBuffer = new BufferDB("MEDIUM", redis);
    this.slowBuffer = new BufferDB("SLOW", redis);
    this.statusDB = new StatusDB(redis);
    this.nullifierDB = new NullifierDB(redis);
    this.logger = logger;
    this.provider = provider;
    this.bundlerAddress = bundlerAddress;
    this.tellerContract = Teller__factory.connect(tellerAddress, provider);
    this.handlerContract = Handler__factory.connect(handlerAddress, provider);

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

    this.ignoreGas = opts.ignoreGas;
    this.storeRequestInfo = opts.storeRequestInfo;
  }

  start(port: number): ActorHandle {
    const router = express.Router();
    router.post(
      "/relay",
      makeRelayHandler({
        buffers: {
          fastBuffer: this.fastBuffer,
          mediumBuffer: this.mediumBuffer,
          slowBuffer: this.slowBuffer,
        },
        statusDB: this.statusDB,
        nullifierDB: this.nullifierDB,
        redis: this.redis,
        pool: this.pool,
        bundlerAddress: this.bundlerAddress,
        tellerContract: this.tellerContract,
        handlerContract: this.handlerContract,
        provider: this.provider,
        logger: this.logger.child({
          route: "/relay",
          function: "relayHandler",
        }),
        metrics: this.metrics,
        opts: {
          storeRequestInfo: this.storeRequestInfo,
          ignoreGas: this.ignoreGas,
        },
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

    app.set("trust proxy", 1); // we know we're behind single AWS LB
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
