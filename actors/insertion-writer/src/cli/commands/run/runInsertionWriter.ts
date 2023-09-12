import { Command } from "commander";
import { InsertionWriter } from "../../../";
import { getRedis } from "../utils";
import { makeLogger } from "@nocturne-xyz/offchain-utils";
import { extractConfigName, loadNocturneConfig } from "@nocturne-xyz/config";
import { SubgraphTreeInsertionSyncAdapter } from "../../../sync/subgraph/adapter";

export const runInsertionWriter = new Command("insertion-writer")
  .summary("run insertion writer service")
  .description("must supply .env file with REDIS_URL and SUBGRAPH_URL")
  .requiredOption(
    "--config-name-or-path <string>",
    "deposit manager contract address"
  )
  .option(
    "--throttle-ms <number>",
    "maximum period of time to wait before polling new insertions",
    parseInt
  )
  .option(
    "--log-dir <string>",
    "directory to write logs to",
    "./logs/insertion-writer"
  )
  .option(
    "--stdout-log-level <string>",
    "min log importance to log to stdout. if not given, logs will not be emitted to stdout"
  )
  .action(async (options) => {
    const { configNameOrPath, logDir, throttleMs, stdoutLogLevel } = options;

    const configName = extractConfigName(configNameOrPath);
    const logger = makeLogger(
      logDir,
      `${configName}-insertion-writer`,
      "insertion-writer",
      stdoutLogLevel
    );

    const config = loadNocturneConfig(configNameOrPath);
    logger.info("config", { config });

    // TODO: enable switching on adapter impl
    const subgraphEndpoint = process.env.SUBGRAPH_URL;
    if (!subgraphEndpoint) {
      throw new Error("missing SUBGRAPH_URL");
    }
    const adapter = new SubgraphTreeInsertionSyncAdapter(
      subgraphEndpoint,
      logger.child({ function: "SubgraphTreeInsertionSyncAdapter" })
    );

    const writer = new InsertionWriter(adapter, getRedis(), logger);

    const { promise } = await writer.start(throttleMs);
    await promise;
  });
