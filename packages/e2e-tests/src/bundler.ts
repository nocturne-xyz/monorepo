import { sleep, makeRedisInstance } from "./utils";
import { BundlerBatcher, BundlerServer, BundlerSubmitter } from "@nocturne-xyz/bundler";
import { ethers } from "ethers";
import IORedis from "ioredis";

export interface BundlerConfig {
  walletAddress: string;
  maxLatency: number;
  rpcUrl: string;
  txSignerKey: string;
  ignoreGas: boolean;
}

const { getRedis, clearRedis } = makeRedisInstance();

export async function startBundler(config: BundlerConfig): Promise<() => Promise<void>> {
  const redis = await getRedis();

  const stopServer = startBundlerServer(config, redis);
  const stopBatcher = startBundlerBatcher(config, redis);
  const stopSubmitter = startBundlerSubmitter(config, redis);
  await sleep(10_000);

  return async () => {
    await Promise.all([
      stopServer(),
      stopBatcher(),
      stopSubmitter(),
    ]);
    await clearRedis();
  }
}

function startBundlerSubmitter(config: BundlerConfig, redis: IORedis): () => Promise<void> {
  const provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);
  const signer = new ethers.Wallet(config.txSignerKey, provider);
  const submitter = new BundlerSubmitter(
    config.walletAddress,
    signer,
    redis
  );

  const [prom, stop] = submitter.start();
  prom.catch(err => {
    console.error("bundler submitter error", err);
    throw err;
  });

  return stop
}

function startBundlerBatcher(config: BundlerConfig, redis: IORedis): () => Promise<void> {
  const batcher = new BundlerBatcher(redis, config.maxLatency);
  const [prom, stop] = batcher.start();
  prom.catch(err => {
    console.error("bundler batcher error", err);
    throw err;
  });

  return stop;
}


function startBundlerServer(config: BundlerConfig, redis: IORedis): () => Promise<void> {
  const provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);
  const server = new BundlerServer(
    config.walletAddress,
    provider,
    redis,
    config.ignoreGas,
  );

  return server.start();
}
