import { Command } from "commander";
import { BundlerBatcher } from "../../../batcher";
import { makeLogger, getRedis } from "@nocturne-xyz/offchain-utils";

const runBatcher = new Command("batcher")
  .summary("run bundler batcher")
  .description("must supply .env file with REDIS_URL and REDIS_PASSWORD.")
  .option("--batch-size <number>", "batch size")
  .option(
    "--max-latency <number>",
    "max latency bundler will wait until creating a bundle"
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
    const { maxLatency, batchSize, logDir, stdoutLogLevel } = options;

    const logger = makeLogger(logDir, "bundler", "batcher", stdoutLogLevel);
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
