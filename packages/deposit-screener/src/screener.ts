import {
  DepositManager,
  DepositManager__factory,
} from "@nocturne-xyz/contracts";
import {
  Address,
  AssetTrait,
  ClosableAsyncIterator,
  DepositRequest,
} from "@nocturne-xyz/sdk";
import { Job, Queue, Worker } from "bullmq";
import { ethers } from "ethers";
import { checkDepositRequest } from "./check";
import { DepositScreenerDB } from "./db";
import { ScreeningApi } from "./screening";
import { DepositEventsBatch, ScreenerSyncAdapter } from "./sync/syncAdapter";
import {
  DepositEventType,
  DepositRequestStatus,
  SCREENER_DELAY_QUEUE,
  DepositRequestJobData,
  DELAYED_DEPOSIT_JOB_TAG,
  getFulfillmentJobTag,
  getFulfillmentQueueName,
} from "./types";
import IORedis from "ioredis";
import { ScreenerDelayCalculator } from "./screenerDelay";
import { hashDepositRequest } from "./typedData";
import * as JSON from "bigint-json-serialization";
import { secsToMillis } from "./utils";
import { Logger } from "winston";
import { ActorHandle } from "@nocturne-xyz/offchain-utils";

export class DepositScreenerScreener {
  adapter: ScreenerSyncAdapter;
  depositManagerContract: DepositManager;
  screeningApi: ScreeningApi;
  delayCalculator: ScreenerDelayCalculator;
  screenerDelayQueue: Queue<DepositRequestJobData>;
  db: DepositScreenerDB;
  redis: IORedis;
  logger: Logger;
  startBlock: number;
  supportedAssets: Set<Address>;

  constructor(
    syncAdapter: ScreenerSyncAdapter,
    depositManagerAddress: Address,
    provider: ethers.providers.Provider,
    redis: IORedis,
    logger: Logger,
    screeningApi: ScreeningApi,
    screenerDelayCalculator: ScreenerDelayCalculator,
    supportedAssets: Set<Address>,
    startBlock?: number
  ) {
    this.redis = redis;
    this.adapter = syncAdapter;
    this.logger = logger;

    this.startBlock = startBlock ?? 0;

    this.depositManagerContract = DepositManager__factory.connect(
      depositManagerAddress,
      provider
    );

    this.db = new DepositScreenerDB(redis);

    this.screenerDelayQueue = new Queue(SCREENER_DELAY_QUEUE, {
      connection: redis,
    });

    this.screeningApi = screeningApi;
    this.delayCalculator = screenerDelayCalculator;

    this.supportedAssets = supportedAssets;
  }

  async start(queryThrottleMs?: number): Promise<ActorHandle> {
    this.logger.info(
      `DepositManager contract: ${this.depositManagerContract.address}.`
    );
    const nextBlockToSync = (await this.db.getNextBlock()) ?? this.startBlock;
    this.logger.info(
      `processing deposit requests starting from block ${nextBlockToSync}`
    );

    const depositEvents = this.adapter.iterDepositEvents(
      DepositEventType.Instantiated,
      nextBlockToSync,
      { maxChunkSize: 100_000, throttleMs: queryThrottleMs }
    );

    const screenerProm = this.startScreener(
      this.logger.child({ function: "screener" }),
      depositEvents
    ).catch((err) => {
      this.logger.error("error in deposit processor screener: ", err);
      throw new Error("error in deposit processor screener: " + err);
    });

    const arbiter = this.startArbiter(
      this.logger.child({ function: "arbiter" })
    );

    const arbiterProm = new Promise<void>((resolve) => {
      arbiter.on("closed", () => {
        this.logger.info("arbiter stopped");
        resolve();
      });
    });

    const teardown = async () => {
      await depositEvents.close();
      await screenerProm;
      await arbiter.close();
      await arbiterProm;
    };

    const promise = (async () => {
      try {
        await Promise.all([screenerProm, arbiterProm]);
      } catch (err) {
        this.logger.error(`error in deposit screener screener: ${err}`, err);
        await teardown();
        throw err;
      }
    })();

    return {
      promise,
      teardown,
    };
  }

  async startScreener(
    logger: Logger,
    depositEvents: ClosableAsyncIterator<DepositEventsBatch>
  ): Promise<void> {
    logger.info("starting screener");
    for await (const batch of depositEvents.iter) {
      for (const event of batch.depositEvents) {
        logger.info(`received deposit event, storing in DB`, event);
        const depositRequest: DepositRequest = {
          ...event,
        };
        await this.db.storeDepositRequest(depositRequest);

        const hash = hashDepositRequest(depositRequest);
        const childLogger = logger.child({
          depositRequestSpender: depositRequest.spender,
          depositReququestNonce: depositRequest.nonce,
          depositRequestHash: hash,
        });

        childLogger.debug(`checking deposit request`);
        const { isSafe, reason } = await checkDepositRequest(
          logger,
          depositRequest,
          {
            ...this,
          }
        );

        if (isSafe) {
          childLogger.info(
            "deposit passed first screening stage. pushing to delay queue"
          );
          await this.scheduleSecondScreeningPhase(childLogger, depositRequest);
          await this.db.setDepositRequestStatus(
            depositRequest,
            DepositRequestStatus.PassedFirstScreen
          );
        } else {
          childLogger.warn(
            `deposit failed first screening stage with reason ${reason}`
          );
          await this.db.setDepositRequestStatus(
            depositRequest,
            DepositRequestStatus.FailedScreen
          );
        }
      }
      await this.db.setNextBlock(batch.blockNumber);
    }
  }

  async scheduleSecondScreeningPhase(
    logger: Logger,
    depositRequest: DepositRequest
  ): Promise<void> {
    logger.debug(`calculating delay until second phase of screening`);
    const delaySeconds = await this.delayCalculator.calculateDelaySeconds(
      depositRequest.spender,
      AssetTrait.decode(depositRequest.encodedAsset).assetAddr,
      depositRequest.value
    );

    const depositRequestJson = JSON.stringify(depositRequest);
    const jobData: DepositRequestJobData = {
      depositRequestJson,
      enqueuedDateString: JSON.stringify(Date.now()),
    };

    logger.info(
      `scheduling second phase of screening to start in ${delaySeconds} seconds`
    );
    await this.screenerDelayQueue.add(DELAYED_DEPOSIT_JOB_TAG, jobData, {
      jobId: hashDepositRequest(depositRequest),
      delay: secsToMillis(delaySeconds),
      // TODO: do we need retries?
      // if the job fails, re-try it at most 5x with exponential backoff (1s, 2s, 4s)
      attempts: 5,
      backoff: {
        type: "exponential",
        delay: 1000,
      },
    });
  }

  startArbiter(logger: Logger): Worker<DepositRequestJobData, any, string> {
    logger.info("starting arbiter...");

    return new Worker(
      SCREENER_DELAY_QUEUE,
      async (job: Job<DepositRequestJobData>) => {
        logger.debug("processing deposit request");
        const depositRequest: DepositRequest = JSON.parse(
          job.data.depositRequestJson
        );
        const depositHash = hashDepositRequest(depositRequest);
        const childLogger = logger.child({
          depositRequestSpender: depositRequest.spender,
          depositReququestNonce: depositRequest.nonce,
          depositRequestHash: depositHash,
        });

        const assetAddr = AssetTrait.decode(
          depositRequest.encodedAsset
        ).assetAddr;
        if (!this.supportedAssets.has(assetAddr)) {
          throw new Error(
            `received deposit request for unsupported asset ${assetAddr} in arbiter. This should have been caught by screener`
          );
        }

        childLogger.info("processing deposit request");

        const inSet =
          await this.depositManagerContract._outstandingDepositHashes(
            depositHash
          );
        if (!inSet) {
          childLogger.warn(`deposit already retrieved or completed`);
          return; // Already retrieved or completed
        }

        const valid = await this.screeningApi.isSafeDepositRequest(
          depositRequest.spender,
          AssetTrait.decode(depositRequest.encodedAsset).assetAddr,
          depositRequest.value
        );
        if (!valid) {
          childLogger.warn(`deposit failed second screening screening`);
          return;
        }

        childLogger.info(
          `deposit request passed screening. pushing to fulfillment queue`
        );

        const depositRequestJson = JSON.stringify(depositRequest);
        const jobData: DepositRequestJobData = {
          depositRequestJson,
          enqueuedDateString: JSON.stringify(Date.now()),
        };

        // figure out which fulfillment queue to add to
        const fulfillmentQueue = new Queue(getFulfillmentQueueName(assetAddr), {
          connection: this.redis,
        });

        const jobTag = getFulfillmentJobTag(assetAddr);

        // submit to it
        await fulfillmentQueue.add(jobTag, jobData, { jobId: depositHash });
        await this.db.setDepositRequestStatus(
          depositRequest,
          DepositRequestStatus.AwaitingFulfillment
        );
      },
      { connection: this.redis, autorun: true }
    );
  }
}
