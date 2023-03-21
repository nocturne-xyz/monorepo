import {
  DepositManager,
  DepositManager__factory,
} from "@nocturne-xyz/contracts";
import { Address, DepositRequest } from "@nocturne-xyz/sdk";
import { Queue } from "bullmq";
import { ethers } from "ethers";
import { checkDepositRequest } from "./check";
import { DepositScreenerDB } from "./db";
import { enqueueDepositRequest } from "./enqueue";
import { DummyScreeningApi, ScreeningApi } from "./screening";
import { ScreenerSyncAdapter } from "./sync/syncAdapter";
import {
  DepositEventType,
  DepositRequestStatus,
  DELAYED_DEPOSIT_QUEUE,
} from "./types";
import { getRedis } from "./utils";
import IORedis from "ioredis";
import { DelayCalculator, DummyDelayCalculator } from "./delay";

export class DepositScreenerProcessor {
  adapter: ScreenerSyncAdapter;
  depositManagerContract: DepositManager;
  screeningApi: ScreeningApi;
  db: DepositScreenerDB;
  delayCalculator: DelayCalculator;
  delayQueue: Queue;

  constructor(
    syncAdapter: ScreenerSyncAdapter,
    depositManagerAddress: Address,
    provider: ethers.providers.Provider,
    redis?: IORedis
  ) {
    this.adapter = syncAdapter;

    this.depositManagerContract = DepositManager__factory.connect(
      depositManagerAddress,
      provider
    );

    const connection = getRedis(redis);
    this.db = new DepositScreenerDB(connection);
    this.delayQueue = new Queue(DELAYED_DEPOSIT_QUEUE, { connection });

    this.screeningApi = new DummyScreeningApi();
    this.delayCalculator = new DummyDelayCalculator();
  }

  async run(): Promise<void> {
    const nextBlockToSync = await this.db.getNextBlock();
    console.log(
      `processing deposit requests starting from block ${nextBlockToSync}`
    );

    const depositEvents = this.adapter.iterDepositEvents(
      DepositEventType.Instantiated,
      nextBlockToSync,
      { maxChunkSize: 10_000 }
    );

    for await (const batch of depositEvents.iter) {
      for (const event of batch.depositEvents) {
        const result = await this.handleDepositRequest({ ...event });
        await this.db.setDepositRequestStatus({ ...event }, result);
      }
      await this.db.setNextBlock(batch.blockNumber);
    }
  }

  async handleDepositRequest(
    depositRequest: DepositRequest
  ): Promise<DepositRequestStatus> {
    const status = await checkDepositRequest(depositRequest, { ...this });

    if (status == DepositRequestStatus.PassedScreen) {
      await enqueueDepositRequest(depositRequest, { ...this });
      return DepositRequestStatus.Enqueued;
    } else {
      return status;
    }
  }
}
