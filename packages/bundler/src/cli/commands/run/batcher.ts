import { Command } from "commander";
import { BundlerBatcher } from "../../../batcher";

const runBatcher = new Command("batcher")
  .summary("Run bundler batcher")
  .description("Must supply .env file with REDIS_URL.")
  .option("--batch-size <number>", "batch size")
  .option(
    "--max-latency <number>",
    "max latency bundler will wait until creating a bundle"
  )
  .action(async (options) => {
    const { maxLatency, batchSize } = options;
    const batcher = new BundlerBatcher(maxLatency, batchSize);
    await batcher.run();
  });

export default runBatcher;
