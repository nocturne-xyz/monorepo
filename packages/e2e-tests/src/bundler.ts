import { TeardownFn, makeRedisInstance } from "./utils";
import { makeTestLogger } from "@noctune-xyz/offchain-utils";
import {
  BundlerBatcher,
  BundlerServer,
  BundlerSubmitter,
} from "@nocturne-xyz/bundler";
import { ethers } from "ethers";
import IORedis from "ioredis";

export interface BundlerConfig {
  walletAddress: string;
  maxLatency: number;
  rpcUrl: string;
  txSignerKey: string;
  ignoreGas?: boolean;
}

const { getRedis, clearRedis } = makeRedisInstance();

export async function startBundler(config: BundlerConfig): Promise<TeardownFn> {
  const redis = await getRedis();

  const stopServer = startBundlerServer(config, redis);
  const stopBatcher = startBundlerBatcher(config, redis);
  const stopSubmitter = startBundlerSubmitter(config, redis);

  return async () => {
    await Promise.all([stopServer(), stopBatcher(), stopSubmitter()]);
    await clearRedis();
  };
}

function startBundlerSubmitter(
  config: BundlerConfig,
  redis: IORedis
): TeardownFn {
  const provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);
  const signer = new ethers.Wallet(config.txSignerKey, provider);
  const logger = makeTestLogger("bundler", "submitter");
  const submitter = new BundlerSubmitter(
    config.walletAddress,
    signer,
    redis,
    logger
  );

  const { promise, teardown } = submitter.start();
  promise.catch((err) => {
    console.error("bundler submitter error", err);
    throw err;
  });

  return teardown;
}

function startBundlerBatcher(
  config: BundlerConfig,
  redis: IORedis
): TeardownFn {
  const logger = makeTestLogger("bundler", "batcher");
  const batcher = new BundlerBatcher(redis, logger, config.maxLatency);
  const { promise, teardown } = batcher.start();
  promise.catch((err) => {
    console.error("bundler batcher error", err);
    throw err;
  });

  return teardown;
}

function startBundlerServer(config: BundlerConfig, redis: IORedis): TeardownFn {
  const provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);
  const logger = makeTestLogger("bundler", "server");
  const server = new BundlerServer(
    config.walletAddress,
    provider,
    redis,
    logger,
    config.ignoreGas
  );

  return server.start(3000);
}
