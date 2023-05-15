import { Erc20Config } from "@nocturne-xyz/config";
import {
  Address,
  AssetTrait,
  AssetType,
  DepositRequest,
  max,
  parseEventsFromContractReceipt,
  unzip,
} from "@nocturne-xyz/sdk";
import { DepositRateLimiter } from "./rateLimiter";
import { DepositScreenerDB } from "./db";
import IORedis from "ioredis";
import { ethers } from "ethers";
import { Job, Worker } from "bullmq";
import { Logger } from "winston";
import {
  DepositRequestJobData,
  DepositRequestStatus,
  getFulfillmentQueueName,
} from "./types";
import {
  DepositManager,
  DepositManager__factory,
} from "@nocturne-xyz/contracts";
import {
  EIP712Domain,
  hashDepositRequest,
  signDepositRequest,
} from "./typedData";
import { Mutex } from "async-mutex";
import {
  DEPOSIT_MANAGER_CONTRACT_NAME,
  DEPOSIT_MANAGER_CONTRACT_VERSION,
} from "./typedData/constants";
import * as JSON from "bigint-json-serialization";
import { DepositCompletedEvent } from "@nocturne-xyz/contracts/dist/src/DepositManager";

export interface DepositScreenerFulfillerHandle {
  // promise that resolves when the service is done
  promise: Promise<void>;
  // function to teardown the service
  teardown: () => Promise<void>;
}

const ONE_HOUR_IN_MS = 60 * 60 * 1000;

export class DepositScreenerFulfiller {
  supportedAssets: Map<string, Erc20Config>;
  signerMutex: Mutex;
  depositManagerContract: DepositManager;
  attestationSigner: ethers.Wallet;
  txSigner: ethers.Wallet;
  redis: IORedis;
  db: DepositScreenerDB;

  constructor(
    depositManagerAddress: Address,
    txSigner: ethers.Wallet,
    attestationSigner: ethers.Wallet,
    redis: IORedis,
    supportedAssets: Map<string, Erc20Config>
  ) {
    this.redis = redis;
    this.db = new DepositScreenerDB(redis);

    this.txSigner = txSigner;
    this.attestationSigner = attestationSigner;
    this.signerMutex = new Mutex();

    this.depositManagerContract = DepositManager__factory.connect(
      depositManagerAddress,
      txSigner
    );

    this.supportedAssets = supportedAssets;
  }

  start(parentLogger: Logger): DepositScreenerFulfillerHandle {
    const [proms, closeFns] = unzip(
      [...this.supportedAssets.entries()].map(([ticker, config]) => {
        // make a rate limiter with the current asset's global rate limit and set the period to 1 hour
        const logger = parentLogger.child({ assetTicker: ticker });
        logger.info(`starting deposit screener fulfiller for asset ${ticker}`);
        const rateLimiter = new DepositRateLimiter(
          config.globalCapWholeTokens * 10n ** config.precision,
          ONE_HOUR_IN_MS
        );

        // make a worker listening to the current asset's fulfillment queue
        const worker = new Worker(
          getFulfillmentQueueName(ticker),
          async (job: Job<DepositRequestJobData>) => {
            const depositRequest: DepositRequest = JSON.parse(
              job.data.depositRequestJson
            );
            logger.info(
              `attempting to fulfill deposit request: ${depositRequest}`
            );
            const hash = hashDepositRequest(depositRequest);
            const childLogger = logger.child({
              depositRequestSpender: depositRequest.spender,
              depositReququestNonce: depositRequest.nonce,
              depositRequestHash: hash,
            });

            // update rate limit window
            rateLimiter.removeOldEntries();

            // if the deposit would exceed the rate limit, pause the queue
            if (rateLimiter.wouldExceedRateLimit(depositRequest.value)) {
              childLogger.warn(
                `fulfilling deposit ${hash} would exceed rate limit`
              );

              // not sure if it's possible for the RHS to be < 0, but my gut tells me it is so adding the check just to be safe
              const queueDelay = max(
                0,
                rateLimiter.timeWhenAmountAvailable(depositRequest.value) -
                  Date.now()
              );

              childLogger.debug(`delaying`);
              await worker.rateLimit(queueDelay);

              throw Worker.RateLimitError();
            }

            // otherwise, sign and submit it
            await this.signAndSubmitDeposit(childLogger, depositRequest).catch(
              (e) => {
                childLogger.error(e);
                throw new Error(e);
              }
            );
          },
          { connection: this.redis, autorun: true }
        );

        const prom = new Promise<void>((resolve) => {
          worker.on("closed", () => {
            logger.info(`fulfiller for asset ${ticker} closed`);
            resolve();
          });
        });
        const closeFn = async () => {
          await worker.close();
        };

        return [prom, closeFn];
      })
    );

    return {
      promise: (async () => {
        await Promise.all(proms);
      })(),
      teardown: async () => {
        await Promise.all(closeFns.map((fn) => fn()));
      },
    };
  }

  async signAndSubmitDeposit(
    logger: Logger,
    depositRequest: DepositRequest
  ): Promise<void> {
    const domain: EIP712Domain = {
      name: DEPOSIT_MANAGER_CONTRACT_NAME,
      version: DEPOSIT_MANAGER_CONTRACT_VERSION,
      // TODO: fetch from config instead
      chainId: BigInt(await this.txSigner.getChainId()),
      verifyingContract: this.depositManagerContract.address,
    };

    logger.info("signing deposit request");
    const signature = await signDepositRequest(
      this.attestationSigner,
      domain,
      depositRequest
    );

    const asset = AssetTrait.decode(depositRequest.encodedAsset);

    let tx: ethers.ContractTransaction;
    switch (asset.assetType) {
      case AssetType.ERC20:
        logger.info("submitting completeDeposit tx...");
        tx = await this.signerMutex.runExclusive(
          async () =>
            await this.depositManagerContract
              .completeErc20Deposit(depositRequest, signature)
              .catch((e) => {
                logger.error(e);
                throw new Error(e);
              })
        );
        break;
      default:
        throw new Error("currently only supporting erc20 deposits");
    }

    logger.info("waiting for receipt...");
    const receipt = await tx.wait(1);
    logger.info("completeDeposit receipt:", receipt);

    const matchingEvents = parseEventsFromContractReceipt(
      receipt,
      this.depositManagerContract.interface.getEvent("DepositCompleted")
    ) as DepositCompletedEvent[];
    logger.info("matching events:", matchingEvents);

    if (matchingEvents.length > 0) {
      logger.info(
        `deposit signed and submitted. Spender: ${depositRequest.spender}. Nonce: ${depositRequest.nonce}`
      );
      await this.db.setDepositRequestStatus(
        depositRequest,
        DepositRequestStatus.Completed
      );
    } else {
      // NOTE: not sure if possible that tx submission passes but event not found
      logger.error(
        `deposit request failed. Spender: ${depositRequest.spender}. Nonce: ${depositRequest.nonce}`
      );
    }
  }
}
