import {
  Address,
  AssetTrait,
  AssetType,
  DepositEvent,
  DepositRequest,
  DepositRequestStatus,
  hashDepositRequest,
  max,
  unzip,
} from "@nocturne-xyz/core";
import { RateLimitWindow } from "./rateLimitWindow";
import { DepositScreenerDB } from "./db";
import IORedis from "ioredis";
import { ethers } from "ethers";
import { Job, Worker } from "bullmq";
import { Logger } from "winston";
import {
  ACTOR_NAME,
  DepositEventJobData,
  getFulfillmentQueueName,
} from "./types";
import {
  DepositManager,
  DepositManager__factory,
} from "@nocturne-xyz/contracts";
import { EIP712Domain, signDepositRequest } from "./typedData";
import { Mutex } from "async-mutex";
import {
  DEPOSIT_MANAGER_CONTRACT_NAME,
  DEPOSIT_MANAGER_CONTRACT_VERSION,
} from "./typedData/constants";
import * as JSON from "bigint-json-serialization";
import {
  ActorHandle,
  TxHash,
  TxSubmitter,
  makeCreateCounterFn,
  makeCreateHistogramFn,
} from "@nocturne-xyz/offchain-utils";
import * as ot from "@opentelemetry/api";
import { millisToSeconds } from "./utils";
import retry from "async-retry";

const ONE_HOUR_IN_MS = 60 * 60 * 1000;
const COMPONENT_NAME = "fulfiller";

interface DepositScreenerFulfillerMetrics {
  requeueDelayHistogram: ot.Histogram;
  fulfilledDepositsCounter: ot.Counter;
  fulfilledDepositsValueCounter: ot.Counter;
}

export class DepositScreenerFulfiller {
  logger: Logger;
  supportedAssets: Set<Address>;
  signerMutex: Mutex;
  depositManagerContract: DepositManager;
  provider: ethers.providers.JsonRpcProvider;
  txSubmitter: TxSubmitter;
  attestationSigner: ethers.Wallet;
  redis: IORedis;
  db: DepositScreenerDB;
  metrics: DepositScreenerFulfillerMetrics;
  finalityBlocks: number;

  constructor(
    logger: Logger,
    depositManagerAddress: Address,
    provider: ethers.providers.JsonRpcProvider,
    txSubmitter: TxSubmitter,
    attestationSigner: ethers.Wallet,
    redis: IORedis,
    supportedAssets: Set<Address>,
    finalityBlocks = 1
  ) {
    this.logger = logger;
    this.redis = redis;
    this.db = new DepositScreenerDB(redis);

    this.provider = provider;
    this.txSubmitter = txSubmitter;
    this.attestationSigner = attestationSigner;
    this.signerMutex = new Mutex();

    this.finalityBlocks = finalityBlocks;

    this.depositManagerContract = DepositManager__factory.connect(
      depositManagerAddress,
      this.provider
    );

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
      requeueDelayHistogram: createHistogram(
        "fullfiller_requeue_delay.histogram",
        "Delay between when a deposit is requeued due to hitting global rate limit",
        "seconds"
      ),
      fulfilledDepositsCounter: createCounter(
        "fulfilled_deposits.counter",
        "Fulfilled deposits, attributed by asset"
      ),
      fulfilledDepositsValueCounter: createCounter(
        "fulfilled_deposits_value.counter",
        "Fulfilled deposits value, attributed by asset"
      ),
    };
  }

  async start(): Promise<ActorHandle> {
    // we have 1 fulfillment queue per asset. this is because the rate limit is queue-wide,
    // we have no way to only rate limit a subset of the jobs in a queue, so we can't implement
    // per-asset rate limits with a single fulfillment queue
    const [proms, closeFns] = unzip(
      await Promise.all(
        [...this.supportedAssets.values()].map(async (address) => {
          // make a rate limiter with the current asset's global rate limit and set the period to 1 hour
          const logger = this.logger.child({ assetAddr: address });
          logger.info(
            `starting deposit screener fulfiller for asset ${address}`
          );

          const window = await this.getErc20RateLimitWindow(address);

          // make a worker listening to the current asset's fulfillment queue
          const worker = new Worker(
            getFulfillmentQueueName(address),
            async (job: Job<DepositEventJobData>) => {
              const depositEvent: DepositEvent = JSON.parse(
                job.data.depositEventJson
              );
              logger.info(
                `attempting to fulfill deposit request: ${depositEvent}`,
                { depositEvent }
              );
              const hash = hashDepositRequest(depositEvent);
              const childLogger = logger.child({
                depositTxHash: depositEvent.txHash,
                depositTimestamp: depositEvent.timestamp,
                depositRequestSpender: depositEvent.spender,
                depositReququestNonce: depositEvent.nonce,
                depositRequestHash: hash,
              });

              childLogger.debug(
                `checking if deposit request still outstanding`
              );
              const inSet =
                await this.depositManagerContract._outstandingDepositHashes(
                  hash
                );
              if (!inSet) {
                childLogger.warn(`deposit already retrieved or completed`);
                return; // Already retrieved or completed
              }

              // update rate limit window
              window.removeOldEntries();

              // if the deposit would exceed the rate limit, pause the queue
              if (window.wouldExceedRateLimit(depositEvent.value)) {
                childLogger.warn(
                  `fulfilling deposit ${hash} would exceed rate limit`,
                  { depositEvent }
                );

                // not sure if it's possible for the RHS to be < 0, but my gut tells me it is so adding the check just to be safe
                const queueDelay = max(
                  0,
                  window.timeWhenAmountAvailable(depositEvent.value) -
                    Date.now()
                );

                childLogger.debug(`delaying`);
                await worker.rateLimit(queueDelay);

                this.metrics.requeueDelayHistogram.record(
                  millisToSeconds(queueDelay)
                );

                throw Worker.RateLimitError();
              }

              // otherwise, sign and submit it
              await this.signAndSubmitDeposit(childLogger, depositEvent);

              const attributes = {
                spender: depositEvent.spender,
                assetAddr: address,
              };
              this.metrics.fulfilledDepositsCounter.add(1, attributes);
              this.metrics.fulfilledDepositsValueCounter.add(
                Number(depositEvent.value),
                attributes
              );

              const blockNum = this.provider.getBlockNumber();
              const block = await this.provider.getBlock(blockNum);
              const timestamp = block.timestamp;

              window.add({ amount: depositEvent.value, timestamp });
            },
            { connection: this.redis, autorun: true }
          );

          const prom = new Promise<void>((resolve) => {
            worker.on("closed", () => {
              logger.info(`fulfiller for asset ${address} closed`);
              resolve();
            });
          });
          const closeFn = async () => {
            await worker.close();
          };

          return [prom, closeFn];
        })
      )
    );

    const teardown = async () => {
      await Promise.allSettled(closeFns.map((fn) => fn()));
    };

    const promise = (async () => {
      try {
        await Promise.all(proms);
      } catch (err) {
        this.logger.error(`error in fulfiller: ${err}`, { err });
        await teardown();
        throw err;
      }
    })();

    return {
      promise,
      teardown,
    };
  }

  // returns timestamp of the block that the deposit was included in
  async signAndSubmitDeposit(
    logger: Logger,
    depositRequest: DepositRequest
  ): Promise<TxHash> {
    const domain: EIP712Domain = {
      name: DEPOSIT_MANAGER_CONTRACT_NAME,
      version: DEPOSIT_MANAGER_CONTRACT_VERSION,
      // TODO: fetch from config instead
      chainId: BigInt((await this.provider.getNetwork()).chainId),
      verifyingContract: this.depositManagerContract.address,
    };

    logger.info("signing deposit request");
    const signature = await signDepositRequest(
      this.attestationSigner,
      domain,
      depositRequest
    );

    const asset = AssetTrait.decode(depositRequest.encodedAsset);
    const txHash = await retry(
      async () =>
        await this.signerMutex.runExclusive(async () => {
          switch (asset.assetType) {
            case AssetType.ERC20:
              const estimatedGas = (
                await this.depositManagerContract.estimateGas.completeErc20Deposit(
                  depositRequest,
                  signature,
                  {
                    from: await this.txSubmitter.address(),
                  }
                )
              ).toBigInt();

              logger.info(
                `pre-dispatch attempting tx submission. nonce ${depositRequest.nonce}`
              );
              const data =
                this.depositManagerContract.interface.encodeFunctionData(
                  "completeErc20Deposit",
                  [depositRequest, signature]
                );

              const txHash = await this.txSubmitter.submitTransaction(
                { to: this.depositManagerContract.address, data },
                {
                  gasLimit: Number((estimatedGas * 15n) / 10n),
                  logger,
                }
              );

              logger.info(
                `confirmed completeDeposit tx. nonce: ${depositRequest.nonce}. txhash: ${txHash}`
              );
              return txHash;
            default:
              throw new Error("currently only supporting erc20 deposits");
          }
        }),
      {
        retries: 3,
      }
    );

    logger.info(`completeDeposit txHash: ${txHash}`);
    await this.db.setDepositRequestStatus(
      depositRequest,
      DepositRequestStatus.Completed
    );

    return txHash;
  }

  async getErc20RateLimitWindow(
    erc20Address: Address
  ): Promise<RateLimitWindow> {
    const cap = await this.depositManagerContract._erc20Caps(erc20Address);
    const window = new RateLimitWindow(
      BigInt(cap.globalCapWholeTokens) * 10n ** BigInt(cap.precision),
      ONE_HOUR_IN_MS
    );
    window.add({
      amount: cap.runningGlobalDeposited.toBigInt(),
      timestamp: cap.lastResetTimestamp + ONE_HOUR_IN_MS,
    });

    return window;
  }
}
