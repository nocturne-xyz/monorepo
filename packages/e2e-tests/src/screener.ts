import { ethers } from "ethers";
import { TeardownFn, makeRedisInstance } from "./utils";
import { makeTestLogger } from "@nocturne-xyz/offchain-utils";
import {
  DepositScreenerScreener,
  DepositScreenerFulfiller,
  SubgraphScreenerSyncAdapter,
  DepositScreenerServer,
  DummyScreeningApi,
} from "@nocturne-xyz/deposit-screener";
import { Erc20Config } from "@nocturne-xyz/config";
import IORedis from "ioredis";
import { Address } from "@nocturne-xyz/core";
import { DummyScreenerDelayCalculator } from "@nocturne-xyz/deposit-screener/dist/src/screenerDelay";

export interface DepositScreenerConfig {
  depositManagerAddress: string;
  subgraphUrl: string;
  rpcUrl: string;
  attestationSignerKey: string;
  txSignerKey: string;
  dummyScreeningDelaySeconds?: number;
}

const { getRedis, clearRedis } = makeRedisInstance();

export async function startDepositScreener(
  config: DepositScreenerConfig,
  supportedAssets: Map<string, Erc20Config>
): Promise<TeardownFn> {
  const redis = await getRedis();

  const supportedAssetsSet = new Set(
    Array.from(supportedAssets.values()).map((config) => config.address)
  );
  const supportedAssetRateLimits = new Map(
    Array.from(supportedAssets.values()).map((config) => [
      config.address,
      BigInt(config.globalCapWholeTokens) * 10n ** BigInt(config.precision),
    ])
  );

  const stopProcessor = await startDepositScreenerScreener(
    config,
    redis,
    supportedAssetsSet
  );
  const stopFulfiller = await startDepositScreenerFulfiller(
    config,
    redis,
    supportedAssetsSet
  );
  const stopServer = startDepositScreenerServer(
    config,
    redis,
    supportedAssetRateLimits
  );

  return async () => {
    await stopProcessor();
    await stopFulfiller();
    await stopServer();
    await clearRedis();
  };
}

async function startDepositScreenerScreener(
  config: DepositScreenerConfig,
  redis: IORedis,
  supportedAssets: Set<Address>
): Promise<TeardownFn> {
  const { depositManagerAddress, subgraphUrl, rpcUrl } = config;

  const logger = makeTestLogger("deposit-screener", "processor");
  const adapter = new SubgraphScreenerSyncAdapter(subgraphUrl, logger);
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const screener = new DepositScreenerScreener(
    adapter,
    depositManagerAddress,
    provider,
    redis,
    logger,
    new DummyScreeningApi(),
    new DummyScreenerDelayCalculator(config.dummyScreeningDelaySeconds ?? 5),
    supportedAssets
  );

  const { promise, teardown } = await screener.start();
  return async () => {
    await teardown();
    await promise;
  };
}

async function startDepositScreenerFulfiller(
  config: DepositScreenerConfig,
  redis: IORedis,
  supportedAssets: Set<Address>
): Promise<TeardownFn> {
  const { depositManagerAddress, rpcUrl, attestationSignerKey, txSignerKey } =
    config;

  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const txSigner = new ethers.Wallet(txSignerKey, provider);
  const attestationSigner = new ethers.Wallet(attestationSignerKey);

  const logger = makeTestLogger("deposit-screener", "fulfiller");

  const fulfiller = new DepositScreenerFulfiller(
    logger,
    depositManagerAddress,
    txSigner,
    attestationSigner,
    redis,
    supportedAssets
  );

  const { promise, teardown } = await fulfiller.start();

  return async () => {
    await teardown();
    await promise;
  };
}

function startDepositScreenerServer(
  config: DepositScreenerConfig,
  redis: IORedis,
  supportedAssetRateLimits: Map<Address, bigint>
): TeardownFn {
  const logger = makeTestLogger("deposit-screener", "server");

  const server = new DepositScreenerServer(
    logger,
    redis,
    new DummyScreeningApi(),
    new DummyScreenerDelayCalculator(config.dummyScreeningDelaySeconds ?? 5),
    supportedAssetRateLimits
  );

  const { teardown } = server.start(3001);
  return teardown;
}
