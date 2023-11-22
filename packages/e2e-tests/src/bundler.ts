import { TeardownFn, makeRedisInstance } from "./utils";
import {
  EthersTxSubmitter,
  createPool,
  makeTestLogger,
} from "@nocturne-xyz/offchain-utils";
import {
  BundlerBatcher,
  BundlerServer,
  BundlerSubmitter,
} from "@nocturne-xyz/bundler";
import { ethers } from "ethers";
import IORedis from "ioredis";
import { Knex } from "knex";

export interface BundlerConfig {
  bundlerAddress: string;
  tellerAddress: string;
  handlerAddress: string;
  maxLatency: number;
  rpcUrl: string;
  txSignerKey: string;
  ignoreGas?: boolean;
}

const { getRedis, clearRedis } = makeRedisInstance();

export async function startBundler(config: BundlerConfig): Promise<TeardownFn> {
  const redis = await getRedis();
  const pool = createPool();
  const stopServer = startBundlerServer(config, redis, pool);
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
  const txSubmitter = new EthersTxSubmitter(
    new ethers.Wallet(config.txSignerKey, provider)
  );
  const logger = makeTestLogger("bundler", "submitter");
  const submitter = new BundlerSubmitter(
    config.tellerAddress,
    config.handlerAddress,
    provider,
    txSubmitter,
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

function startBundlerServer(
  config: BundlerConfig,
  redis: IORedis,
  pool: Knex
): TeardownFn {
  const provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);
  const logger = makeTestLogger("bundler", "server");
  const server = new BundlerServer(
    config.bundlerAddress,
    config.tellerAddress,
    config.handlerAddress,
    provider,
    redis,
    logger,
    pool,
    config.ignoreGas
  );

  const { promise, teardown } = server.start(3000);
  promise.catch((err) => {
    console.error("bundler server error", err);
    throw err;
  });

  return teardown;
}
