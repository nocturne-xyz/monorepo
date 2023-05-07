import {
  DepositManager,
  DepositManager__factory,
} from "@nocturne-xyz/contracts";
import {
  Address,
  ClosableAsyncIterator,
  DepositRequest,
  parseEventsFromContractReceipt,
} from "@nocturne-xyz/sdk";
import { Job, Queue, Worker } from "bullmq";
import { ethers } from "ethers";
import { checkDepositRequest } from "./check";
import { DepositScreenerDB } from "./db";
import { DummyScreeningApi, ScreeningApi } from "./screening";
import { DepositEventsBatch, ScreenerSyncAdapter } from "./sync/syncAdapter";
import {
  DepositEventType,
  DepositRequestStatus,
  DELAYED_DEPOSIT_QUEUE,
  DelayedDepositJobData,
  DELAYED_DEPOSIT_JOB_TAG,
} from "./types";
import IORedis from "ioredis";
import { DelayCalculator, DummyDelayCalculator } from "./delay";
import {
  EIP712Domain,
  hashDepositRequest,
  signDepositRequest,
} from "./typedData";
import {
  DEPOSIT_MANAGER_CONTRACT_NAME,
  DEPOSIT_MANAGER_CONTRACT_VERSION,
} from "./typedData/constants";
import { DepositCompletedEvent } from "@nocturne-xyz/contracts/dist/src/DepositManager";
import * as JSON from "bigint-json-serialization";
import { secsToMillis } from "./utils";
import { Logger } from "winston";
import { TypedDataSigner } from "@ethersproject/abstract-signer"; // TODO: replace with ethers post update

export interface DepositScreenerProcessorHandle {
  // promise that resolves when the service is done
  promise: Promise<void>;
  // function to teardown the service
  teardown: () => Promise<void>;
}

export class DepositScreenerProcessor {
  adapter: ScreenerSyncAdapter;
  depositManagerContract: DepositManager;
  screeningApi: ScreeningApi;
  delayCalculator: DelayCalculator;
  delayQueue: Queue;
  db: DepositScreenerDB;
  redis: IORedis;
  attestationSigner: TypedDataSigner;
  txSigner: ethers.Wallet;
  logger: Logger;
  startBlock: number;

  constructor(
    syncAdapter: ScreenerSyncAdapter,
    depositManagerAddress: Address,
    attestationSigner: TypedDataSigner,
    txSigner: ethers.Wallet,
    redis: IORedis,
    logger: Logger,
    startBlock?: number
  ) {
    this.redis = redis;
    this.adapter = syncAdapter;
    this.logger = logger;

    this.startBlock = startBlock ?? 0;

    this.attestationSigner = attestationSigner;
    this.txSigner = txSigner;

    this.depositManagerContract = DepositManager__factory.connect(
      depositManagerAddress,
      txSigner
    );

    this.db = new DepositScreenerDB(redis);
    this.delayQueue = new Queue(DELAYED_DEPOSIT_QUEUE, { connection: redis });

    this.screeningApi = new DummyScreeningApi();
    this.delayCalculator = new DummyDelayCalculator();
  }

  async start(
    queryThrottleMs?: number
  ): Promise<DepositScreenerProcessorHandle> {
    const nextBlockToSync = (await this.db.getNextBlock()) ?? this.startBlock;
    this.logger.info(
      `processing deposit requests starting from block ${nextBlockToSync}`
    );

    const depositEvents = this.adapter.iterDepositEvents(
      DepositEventType.Instantiated,
      nextBlockToSync,
      { maxChunkSize: 100_000, throttleMs: queryThrottleMs }
    );

    const screenerProm = this.runScreener(
      this.logger.child({ function: "screener" }),
      depositEvents
    ).catch((err) => {
      this.logger.error("error in deposit processor screener: ", err);
      throw new Error("error in deposit processor screener: " + err);
    });

    const submitter = this.startSubmitter(
      this.logger.child({ function: "submitter" })
    );

    const submitterProm = new Promise<void>((resolve) => {
      submitter.on("closed", () => {
        this.logger.info("submitter stopped");
        resolve();
      });
    });

    return {
      promise: (async () => {
        await Promise.all([screenerProm, submitterProm]);
      })(),
      teardown: async () => {
        await depositEvents.close();
        await screenerProm;
        await submitter.close();
        await submitterProm;
      },
    };
  }

  async runScreener(
    logger: Logger,
    depositEvents: ClosableAsyncIterator<DepositEventsBatch>
  ): Promise<void> {
    logger.info("starting screener");
    for await (const batch of depositEvents.iter) {
      for (const event of batch.depositEvents) {
        logger.debug(`received deposit event`, event);
        const {
          spender,
          encodedAsset,
          value,
          depositAddr,
          nonce,
          gasCompensation,
        } = event;
        const depositRequest: DepositRequest = {
          spender,
          encodedAsset,
          value,
          depositAddr,
          nonce,
          gasCompensation,
        };

        const result = await this.handleDepositRequest(
          logger.child({ depositRequest }),
          depositRequest
        );
        await this.db.setDepositRequestStatus(depositRequest, result);
      }
      await this.db.setNextBlock(batch.blockNumber);
    }
  }

  async handleDepositRequest(
    logger: Logger,
    depositRequest: DepositRequest
  ): Promise<DepositRequestStatus> {
    logger.debug(`checking deposit request`);
    const status = await checkDepositRequest(logger, depositRequest, {
      ...this,
    });

    if (status == DepositRequestStatus.PassedScreen) {
      await this.enqueueDepositRequest(logger, depositRequest);
      return DepositRequestStatus.Enqueued;
    } else {
      logger.warn(`deposit request not queued with status ${status}`);
      return status;
    }
  }

  async enqueueDepositRequest(
    logger: Logger,
    depositRequest: DepositRequest
  ): Promise<DepositRequestStatus> {
    logger.debug(`calculating deposit request delay`);
    const delaySeconds = await this.delayCalculator.calculateDelaySeconds(
      depositRequest
    );

    const depositRequestJson = JSON.stringify(depositRequest);
    const jobData: DelayedDepositJobData = {
      depositRequestJson,
    };

    logger.info(`enqueuing deposit request with delay ${delaySeconds} seconds`);
    await this.delayQueue.add(DELAYED_DEPOSIT_JOB_TAG, jobData, {
      delay: secsToMillis(delaySeconds),
      // if the job fails, re-try it at most 5x with exponential backoff (1s, 2s, 4s)
      attempts: 5,
      backoff: {
        type: "exponential",
        delay: 1000,
      },
    });
    return DepositRequestStatus.Enqueued;
  }

  startSubmitter(logger: Logger): Worker<DelayedDepositJobData, any, string> {
    logger.info("starting submitter...");
    logger.info(
      `DepositManager contract: ${this.depositManagerContract.address}.`
    );

    return new Worker(
      DELAYED_DEPOSIT_QUEUE,
      async (job: Job<DelayedDepositJobData>) => {
        logger.debug("processing deposit request");
        const depositRequest: DepositRequest = JSON.parse(
          job.data.depositRequestJson
        );
        const hash = hashDepositRequest(depositRequest);
        const childLogger = logger.child({
          depositRequestSpender: depositRequest.spender,
          depositReququestNonce: depositRequest.nonce,
          depositRequestHash: hash,
        });

        childLogger.info("processing deposit request");

        const inSet =
          await this.depositManagerContract._outstandingDepositHashes(hash);
        if (!inSet) {
          childLogger.warn(`deposit already retrieved or completed`);
          return; // Already retrieved or completed
        }

        const valid = await this.screeningApi.validDepositRequest(
          depositRequest
        );
        if (!valid) {
          childLogger.warn(`deposit no longer passes screening`);
          return;
        }

        await this.signAndSubmitDeposit(childLogger, depositRequest).catch(
          (e) => {
            childLogger.error(e);
            throw new Error(e);
          }
        );
      },
      { connection: this.redis, autorun: true }
    );
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

    logger.info("submitting completeDeposit tx...");
    const tx = await this.depositManagerContract
      .completeErc20Deposit(depositRequest, signature)
      .catch((e) => {
        logger.error(e);
        throw new Error(e);
      });

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
