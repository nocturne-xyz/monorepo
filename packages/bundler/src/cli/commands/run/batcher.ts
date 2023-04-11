import { Command } from "commander";
import { BundlerBatcher } from "../../../batcher";
import { getRedis, makeLogger } from "../../utils";

const runBatcher = new Command("batcher")
  .summary("run bundler batcher")
  .description("must supply .env file with REDIS_URL.")
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
  .action(async (options) => {
    const { maxLatency, batchSize, logDir } = options;

    const logger = makeLogger(logDir, "batcher");
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
