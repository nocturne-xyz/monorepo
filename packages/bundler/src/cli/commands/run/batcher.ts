import { Command } from "commander";
import { BundlerBatcher } from "../../../batcher";
import { getRedis } from "../../utils";

const runBatcher = new Command("batcher")
  .summary("run bundler batcher")
  .description("must supply .env file with REDIS_URL.")
  .option("--batch-size <number>", "batch size")
  .option(
    "--max-latency <number>",
    "max latency bundler will wait until creating a bundle"
  )
  .action(async (options) => {
    const { maxLatency, batchSize } = options;
    const batcher = new BundlerBatcher(getRedis(), maxLatency, batchSize);
    const { promise } = batcher.start();
    await promise;
  });

export default runBatcher;
