import {
  DepositManager,
  DepositManager__factory,
} from "@nocturne-xyz/contracts";
import {
  Address,
  AssetTrait,
  ClosableAsyncIterator,
  DepositRequest,
  DepositRequestStatus,
  IterSyncOpts,
  TotalEntityIndexTrait,
  hashDepositRequest,
  DepositEventType,
  DepositEventsBatch,
  DepositEventSyncAdapter,
  GAS_PER_DEPOSIT_COMPLETE,
  DepositEvent,
} from "@nocturne-xyz/core";
import {
  ActorHandle,
  makeCreateCounterFn,
  makeCreateHistogramFn,
} from "@nocturne-xyz/offchain-utils";
import * as ot from "@opentelemetry/api";
import * as JSON from "bigint-json-serialization";
import { Job, Queue, Worker } from "bullmq";
import { ethers } from "ethers";
import IORedis from "ioredis";
import { Logger } from "winston";
import { DepositScreenerDB } from "./db";
import { ScreeningCheckerApi } from "./screening";
import { Delay } from "./screening/checks/RuleSet";
import {
  ACTOR_NAME,
  DELAYED_DEPOSIT_JOB_TAG,
  DepositEventJobData,
  SCREENER_DELAY_QUEUE,
  getFulfillmentJobTag,
  getFulfillmentQueueName,
} from "./types";
import { secsToMillis } from "./utils";

const COMPONENT_NAME = "screener";

interface DepositScreenerScreenerMetrics {
  depositInstantiatedValueCounter: ot.Counter;
  depositInstantiatedEventsCounter: ot.Counter;
  depositsPassedFirstScreenCounter: ot.Counter;
  depositsPassedFirstScreenValueCounter: ot.Counter;
  depositsPassedSecondScreenCounter: ot.Counter;
  depositsPassedSecondScreenValueCounter: ot.Counter;
  screeningDelayHistogram: ot.Histogram;
}

export interface DepositScreenerScreenerOpts {
  startBlock?: number;
  skipUndergassedDeposits?: boolean;
}

export class DepositScreenerScreener {
  adapter: DepositEventSyncAdapter;
  depositManagerContract: DepositManager;
  screeningApi: ScreeningCheckerApi;
  screenerDelayQueue: Queue<DepositEventJobData>;
  db: DepositScreenerDB;
  redis: IORedis;
  logger: Logger;
  startBlock: number;
  supportedAssets: Set<Address>;
  metrics: DepositScreenerScreenerMetrics;
  skipUndergassedDeposits: boolean;

  constructor(
    syncAdapter: DepositEventSyncAdapter,
    depositManagerAddress: Address,
    provider: ethers.providers.Provider,
    redis: IORedis,
    logger: Logger,
    screeningApi: ScreeningCheckerApi,
    supportedAssets: Set<Address>,
    opts?: DepositScreenerScreenerOpts
  ) {
    this.redis = redis;
    this.adapter = syncAdapter;
    this.logger = logger;

    this.startBlock = opts?.startBlock ?? 0;
    this.skipUndergassedDeposits = opts?.skipUndergassedDeposits ?? false;

    this.depositManagerContract = DepositManager__factory.connect(
      depositManagerAddress,
      provider
    );

    this.db = new DepositScreenerDB(redis);

    this.screenerDelayQueue = new Queue(SCREENER_DELAY_QUEUE, {
      connection: redis,
    });

    this.screeningApi = screeningApi;
    this.supportedAssets = supportedAssets;

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
      depositInstantiatedValueCounter: createCounter(
        "deposit_instantiated_value.counter",
        "counter for deposit instantiated value, denominated by asset attribute"
      ),
      depositInstantiatedEventsCounter: createCounter(
        "deposit_instantiated_events.counter",
        "counter for deposit instantiated events read, denominated by asset attribute"
      ),
      depositsPassedFirstScreenCounter: createCounter(
        "deposits_passed_first_screen.counter",
        "counter for number of deposits that passed 1st screen"
      ),
      depositsPassedFirstScreenValueCounter: createCounter(
        "deposits_passed_first_screen_value.counter",
        "counter for value of deposits that passed 1st screen, denominated by asset attribute"
      ),
      depositsPassedSecondScreenCounter: createCounter(
        "deposits_passed_second_screen.counter",
        "counter for number of deposits that passed 2nd screen"
      ),
      depositsPassedSecondScreenValueCounter: createCounter(
        "deposits_passed_second_screen_value.counter",
        "counter for value of deposits that passed 2nd screen, denominated by asset attribute"
      ),
      screeningDelayHistogram: createHistogram(
        "screening_delay.histogram",
        "histogram for screening delay in seconds",
        "seconds"
      ),
    };
  }

  async start(opts?: IterSyncOpts): Promise<ActorHandle> {
    this.logger.info(
      `DepositManager contract: ${this.depositManagerContract.address}.`
    );
    const currentTotalEntityIndex = await this.db.getCurrentTotalEntityIndex();
    const nextTotalEntityIndexToSync = currentTotalEntityIndex
      ? currentTotalEntityIndex + 1n
      : 0n;
    this.logger.info(
      `processing deposit requests starting from totalEntityIndex ${nextTotalEntityIndexToSync} (block ${
        TotalEntityIndexTrait.toComponents(nextTotalEntityIndexToSync)
          .blockNumber
      })`,
      {
        nextTotalEntityIndexToSync,
        blockNumber: TotalEntityIndexTrait.toComponents(
          nextTotalEntityIndexToSync
        ).blockNumber,
      }
    );

    const depositEvents = this.adapter.iterDepositEvents(
      DepositEventType.Instantiated,
      nextTotalEntityIndexToSync,
      opts
    );

    const screenerProm = this.startScreener(
      this.logger.child({ function: "screener" }),
      depositEvents
    ).catch((err) => {
      this.logger.error("error in deposit processor screener", { err });
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
        this.logger.error(`error in deposit screener screener`, { err });
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
      const gasPrice = (
        await this.depositManagerContract.provider.getGasPrice()
      ).toBigInt();
      for (const event of batch.depositEvents) {
        const depositRequest: DepositRequest = {
          ...event,
        };

        const assetAddr = AssetTrait.decode(
          depositRequest.encodedAsset
        ).assetAddr;

        const attributes = {
          spender: depositRequest.spender,
          assetAddr: assetAddr,
        };
        this.metrics.depositInstantiatedEventsCounter.add(1, attributes);
        this.metrics.depositInstantiatedValueCounter.add(
          Number(depositRequest.value),
          attributes
        );

        logger.info(`received deposit event, storing in DB`, { event });
        await this.db.storeDepositRequest(depositRequest);

        const hash = hashDepositRequest(depositRequest);
        const childLogger = logger.child({
          depositTxHash: event.txHash,
          depositTimestamp: event.timestamp,
          depositRequestSpender: depositRequest.spender,
          depositReququestNonce: depositRequest.nonce,
          depositRequestHash: hash,
        });

        childLogger.debug(`checking if deposit request still outstanding`);
        const inSet =
          await this.depositManagerContract._outstandingDepositHashes(hash);
        if (!inSet) {
          childLogger.warn(`deposit already retrieved or completed`);
          continue; // Already retrieved or completed
        }

        childLogger.debug(`checking deposit request`);
        if (
          this.skipUndergassedDeposits &&
          depositRequest.gasCompensation <
            (GAS_PER_DEPOSIT_COMPLETE * gasPrice) / 100n
        ) {
          childLogger.warn(
            `ignoring under-gassed deposit request with hash ${hash}`
          );
          continue;
        }

        const checkResult = await this.screeningApi.checkDeposit({
          spender: depositRequest.spender,
          assetAddr,
          value: depositRequest.value,
        });

        if (checkResult.type === "Rejection") {
          childLogger.log(
            "compliance",
            `deposit failed first screening stage. reason: ${checkResult.reason}. txhash: ${event.txHash}`,
            {
              reason: checkResult.reason,
            }
          );
          await this.db.setDepositRequestStatus(
            depositRequest,
            DepositRequestStatus.FailedScreen
          );
        } else {
          childLogger.info(
            "deposit passed first screening stage. pushing to delay queue"
          );
          await this.scheduleSecondScreeningPhase(
            childLogger,
            depositRequest,
            checkResult
          );
          await this.db.setDepositRequestStatus(
            depositRequest,
            DepositRequestStatus.PassedFirstScreen
          );

          this.metrics.depositsPassedFirstScreenCounter.add(1, attributes);
          this.metrics.depositsPassedFirstScreenValueCounter.add(
            Number(depositRequest.value),
            attributes
          );
        }
      }
      await this.db.setCurrentTotalEntityIndex(batch.totalEntityIndex);
    }
  }

  async scheduleSecondScreeningPhase(
    logger: Logger,
    depositRequest: DepositRequest,
    delay: Delay
  ): Promise<void> {
    logger.debug(`calculating delay until second phase of screening`);
    const depositEventJson = JSON.stringify(depositRequest);
    const jobData: DepositEventJobData = {
      depositEventJson,
    };

    logger.info(
      `scheduling second phase of screening to start in ${delay.timeSeconds} seconds`
    );
    await this.screenerDelayQueue.add(DELAYED_DEPOSIT_JOB_TAG, jobData, {
      jobId: hashDepositRequest(depositRequest),
      delay: secsToMillis(delay.timeSeconds),
      // TODO: do we need retries?
      // if the job fails, re-try it at most 5x with exponential backoff (1s, 2s, 4s)
      attempts: 5,
      backoff: {
        type: "exponential",
        delay: 1000,
      },
    });

    const assetAddr = AssetTrait.decode(depositRequest.encodedAsset).assetAddr;
    logger.info("[histogram] delaySeconds", {
      delaySeconds: delay.timeSeconds,
    });
    logger.info("[histogram] spender tag", { spender: depositRequest.spender });
    logger.info("[histogram] assetAddr tag", { assetAddr });

    this.metrics.screeningDelayHistogram.record(delay.timeSeconds, {
      spender: depositRequest.spender,
      assetAddr: assetAddr,
    });
  }

  startArbiter(logger: Logger): Worker<DepositEventJobData, any, string> {
    logger.info("starting arbiter...");

    return new Worker(
      SCREENER_DELAY_QUEUE,
      async (job: Job<DepositEventJobData>) => {
        logger.debug("processing deposit request");
        const depositEvent: DepositEvent = JSON.parse(
          job.data.depositEventJson
        );
        const depositHash = hashDepositRequest(depositEvent);
        const assetAddr = AssetTrait.decode(
          depositEvent.encodedAsset
        ).assetAddr;
        const childLogger = logger.child({
          depositTxHash: depositEvent.txHash,
          depositTimestamp: depositEvent.timestamp,
          depositRequestSpender: depositEvent.spender,
          depositReququestNonce: depositEvent.nonce,
          depositRequestHash: depositHash,
          depositRequestAsset: assetAddr,
        });

        childLogger.info("processing deposit request");

        if (!this.supportedAssets.has(assetAddr)) {
          childLogger.warn(`unsupported asset ${assetAddr}`);
          throw new Error(
            `received deposit request for unsupported asset ${assetAddr} in arbiter. This should have been caught by screener`
          );
        }

        childLogger.debug(`checking if deposit request still outstanding`);
        const inSet =
          await this.depositManagerContract._outstandingDepositHashes(
            depositHash
          );
        if (!inSet) {
          childLogger.warn(`deposit already retrieved or completed`);
          return; // Already retrieved or completed
        }

        childLogger.debug(
          `checking if deposit request passed second screening`
        );
        const checkResult = await this.screeningApi.checkDeposit(
          {
            spender: depositEvent.spender,
            assetAddr,
            value: depositEvent.value,
          },
          {
            skipCacheRead: true, // NOTE: we never resort to cache on final screening check
          }
        );

        if (checkResult.type === "Rejection") {
          childLogger.log(
            "compliance",
            `deposit failed second screening screening. reason: ${checkResult.reason}. txhash: ${depositEvent.txHash}`,
            { reason: checkResult.reason }
          );
          await this.db.setDepositRequestStatus(
            depositEvent,
            DepositRequestStatus.FailedScreen
          );
          return;
        }

        childLogger.info(
          `deposit request passed screening. pushing to fulfillment queue`
        );
        const depositEventJson = JSON.stringify(depositEvent);
        const jobData: DepositEventJobData = {
          depositEventJson,
        };

        // figure out which fulfillment queue to add to
        const fulfillmentQueue = new Queue(getFulfillmentQueueName(assetAddr), {
          connection: this.redis,
        });

        const jobTag = getFulfillmentJobTag(assetAddr);

        // submit to it
        await fulfillmentQueue.add(jobTag, jobData, { jobId: depositHash });
        await this.db.setDepositRequestStatus(
          depositEvent,
          DepositRequestStatus.AwaitingFulfillment
        );

        const attributes = {
          spender: depositEvent.spender,
          assetAddr: assetAddr,
        };
        this.metrics.depositsPassedSecondScreenCounter.add(1, attributes);
        this.metrics.depositsPassedSecondScreenValueCounter.add(
          Number(depositEvent.value),
          attributes
        );
      },
      { connection: this.redis, autorun: true }
    );
  }
}
