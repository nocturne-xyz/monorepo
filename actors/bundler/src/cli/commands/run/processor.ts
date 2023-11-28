import { Command } from "commander";
import { BundlerBatcher } from "../../../batcher";
import {
  getEthersProviderFromEnv,
  getTxSubmitterFromEnv,
  makeLogger,
} from "@nocturne-xyz/offchain-utils";
import { getRedis } from "./utils";
import { extractConfigName, loadNocturneConfig } from "@nocturne-xyz/config";
import { BundlerSubmitter } from "../../../submitter";

const runProcessor = new Command("processor")
  .summary("run bundler processor which batches and submits operations")
  .description(
    "must supply .env file with REDIS_URL,REDIS_PASSWORD, RPC_URL, and TX_SIGNER_KEY."
  )
  .requiredOption(
    "--config-name-or-path <string>",
    "config name or path to Nocturne contract JSON config file"
  )
  .option("--batch-poll-interval <number>", "batch poll interval in seconds")
  .option("--medium-batch-size <number>", "batch size")
  .option("--slow-batch-size <number>", "batch size")
  .option(
    "--medium-batch-latency <number>",
    "max latency batcher will wait before force flushing medium ops into batch"
  )
  .option(
    "--slow-batch-latency <number>",
    "max latency batcher will wait before force flushing slow ops into batch"
  )
  .option(
    "--finality-blocks <number>",
    "number of confirmations to wait for before considering a submitted op finalized",
    parseInt
  )
  .option(
    "--log-dir <string>",
    "directory to write logs to. if not given, logs will only be emitted to stdout."
  )
  .option("--log-level <string>", "min log importance to log to stdout")
  .action(async (options) => {
    const {
      configNameOrPath,
      batchPollInterval,
      mediumBatchSize,
      slowBatchSize,
      mediumBatchLatency,
      slowBatchLatency,
      finalityBlocks,
      logDir,
      logLevel,
    } = options;

    const config = loadNocturneConfig(configNameOrPath);
    const configName = extractConfigName(configNameOrPath);

    const batcherLogger = makeLogger(
      configName,
      "bundler",
      "batcher",
      logLevel,
      logDir
    );
    const batcher = new BundlerBatcher(getRedis(), batcherLogger, {
      pollIntervalSeconds: batchPollInterval,
      mediumBatchSize,
      slowBatchSize,
      mediumBatchLatencySeconds: mediumBatchLatency,
      slowBatchLatencySeconds: slowBatchLatency,
    });

    const provider = getEthersProviderFromEnv();
    const txSubmitter = getTxSubmitterFromEnv();

    const submitterLogger = makeLogger(
      configName,
      "bundler",
      "submitter",
      logLevel,
      logDir
    );
    const submitter = new BundlerSubmitter(
      config.tellerAddress,
      config.handlerAddress,
      provider,
      txSubmitter,
      getRedis(),
      submitterLogger,
      finalityBlocks ?? config.offchain.finalityBlocks
    );

    const batcherHandle = batcher.start();
    const submitterHandle = submitter.start();

    await Promise.all([batcherHandle.promise, submitterHandle.promise]);
  });

export default runProcessor;
