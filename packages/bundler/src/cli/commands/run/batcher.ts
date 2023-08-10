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
    "directory to write logs to",
    "./logs/bundler-server"
  )
  .option(
    "--stdout-log-level <string>",
    "min log importance to log to stdout. if not given, logs will not be emitted to stdout"
  )
  .action(async (options) => {
    const { configNameOrPath, maxLatency, batchSize, logDir, stdoutLogLevel } =
      options;

    // TODO: consolidate batcher and submitter into one component (batcher doesn't need config name)
    const configName = extractConfigName(configNameOrPath);
    const logger = makeLogger(
      logDir,
      `${configName}-bundler`,
      "batcher",
      stdoutLogLevel
    );
    const batcher = new BundlerBatcher(
      getRedis(),
      logger,
      maxLatency,
      batchSize
    );

    const { promise } = batcher.start();
    await promise;
  });

export default runBatcher;
