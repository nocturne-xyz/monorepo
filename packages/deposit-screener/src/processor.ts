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
import { SubgraphScreenerSyncAdapter } from "./sync/subgraph/adapter";
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
    depositManagerAddress: Address,
    provider?: ethers.providers.Provider,
    redis?: IORedis
  ) {
    // TODO: enable switching on adapter impl
    const subgraphEndpoint = process.env.SUGRAPH_ENDPOINT;
    if (!subgraphEndpoint) {
      throw new Error("Missing SUBGRAPH_ENDPOINT");
    }

    this.adapter = new SubgraphScreenerSyncAdapter(subgraphEndpoint);

    let _provider;
    if (provider) {
      _provider = provider;
    } else {
      const rpcUrl = process.env.RPC_URL;
      if (!rpcUrl) {
        throw new Error("Missing RPC_URL");
      }
      _provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    }

    this.depositManagerContract = DepositManager__factory.connect(
      depositManagerAddress,
      _provider
    );

    this.screeningApi = new DummyScreeningApi();
    this.delayCalculator = new DummyDelayCalculator();

    const connection = getRedis(redis);
    this.db = new DepositScreenerDB(connection);
    this.delayQueue = new Queue(DELAYED_DEPOSIT_QUEUE, { connection: redis });
  }

  async run(): Promise<void> {
    const nextBlockToSync = await this.db.getNextBlock();
    const currentBlock =
      await this.depositManagerContract.provider.getBlockNumber();
    console.log(`Syncing from block ${nextBlockToSync} to ${currentBlock}...`);

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
