import { ethers } from "ethers";
import { TeardownFn, makeRedisInstance } from "./utils";
import { makeTestLogger } from "@nocturne-xyz/offchain-utils";
import {
  DepositScreenerScreener,
  DepositScreenerFulfiller,
  SubgraphScreenerSyncAdapter,
} from "@nocturne-xyz/deposit-screener";
import { Erc20Config } from "@nocturne-xyz/config";
import IORedis from "ioredis";

export interface DepositScreenerConfig {
  depositManagerAddress: string;
  subgraphUrl: string;
  rpcUrl: string;
  attestationSignerKey: string;
  txSignerKey: string;
}

const { getRedis, clearRedis } = makeRedisInstance();

export async function startDepositScreener(
  config: DepositScreenerConfig,
  supportedAssets: Map<string, Erc20Config>
): Promise<TeardownFn> {
  const redis = await getRedis();
  const stopProcessor = await startDepositScreenerScreener(
    config,
    redis,
    supportedAssets
  );
  const stopFulfiller = startDepositScreenerFulfiller(
    config,
    redis,
    supportedAssets
  );

  return async () => {
    await stopProcessor();
    await stopFulfiller();
    await clearRedis();
  };
}

async function startDepositScreenerScreener(
  config: DepositScreenerConfig,
  redis: IORedis,
  supportedAssets: Map<string, Erc20Config>
): Promise<TeardownFn> {
  const { depositManagerAddress, subgraphUrl, rpcUrl } = config;

  const adapter = new SubgraphScreenerSyncAdapter(subgraphUrl);
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const logger = makeTestLogger("deposit-screener", "processor");
  const screener = new DepositScreenerScreener(
    adapter,
    depositManagerAddress,
    provider,
    redis,
    logger,
    supportedAssets
  );

  const { promise, teardown } = await screener.start();
  return async () => {
    await teardown();
    await promise;
  };
}

function startDepositScreenerFulfiller(
  config: DepositScreenerConfig,
  redis: IORedis,
  supportedAssets: Map<string, Erc20Config>
): TeardownFn {
  const { depositManagerAddress, rpcUrl, attestationSignerKey, txSignerKey } =
    config;

  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const txSigner = new ethers.Wallet(txSignerKey, provider);
  const attestationSigner = new ethers.Wallet(attestationSignerKey);

  const fulfiller = new DepositScreenerFulfiller(
    depositManagerAddress,
    txSigner,
    attestationSigner,
    redis,
    supportedAssets
  );

  const logger = makeTestLogger("deposit-screener", "fulfiller");
  const { promise, teardown } = fulfiller.start(logger);

  return async () => {
    await teardown();
    await promise;
  };
}
