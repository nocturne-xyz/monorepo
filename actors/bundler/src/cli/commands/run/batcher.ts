import { Command } from "commander";
import { BundlerBatcher } from "../../../batcher";
import { makeLogger } from "@nocturne-xyz/offchain-utils";
import { getRedis } from "./utils";
import { extractConfigName } from "@nocturne-xyz/config";

const runBatcher = new Command("batcher")
  .summary("run bundler batcher")
  .description("must supply .env file with REDIS_URL and REDIS_PASSWORD.")
  .requiredOption(
    "--config-name-or-path <string>",
    "config name or path to Nocturne contract JSON config file"
  )
  .option("--batch-size <number>", "batch size")
  .option(
    "--max-latency <number>",
    "max latency bundler will wait until creating a bundle in seconds"
  )
  .option(
    "--log-dir <string>",
    "directory to write logs to. if not given, logs will only be emitted to stdout."
  )
  .option("--log-level <string>", "min log importance to log to stdout")
  .action(async (options) => {
    const { configNameOrPath, maxLatency, logDir, logLevel } = options;

    // TODO: consolidate batcher and submitter into one component (batcher doesn't need config name)
    const configName = extractConfigName(configNameOrPath);
    const logger = makeLogger(
      configName,
      "bundler",
      "batcher",
      logLevel,
      logDir
    );
    const batcher = new BundlerBatcher(
      getRedis(),
      logger,
      maxLatency
      // TODO
    );

    const { promise } = batcher.start();
    await promise;
  });

export default runBatcher;
