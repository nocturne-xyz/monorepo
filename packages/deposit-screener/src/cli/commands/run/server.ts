import { Command } from "commander";
import { DepositScreenerServer } from "../../../server";
import { makeLogger, getRedis } from "@nocturne-xyz/offchain-utils";
import { loadNocturneConfig } from "@nocturne-xyz/config";
import { DummyScreeningApi } from "../../../screening";
import { DummyScreenerDelayCalculator } from "../../../screenerDelay";

const runServer = new Command("server")
  .summary("run deposit screener server")
  .description(
    "must supply .env file with REDIS_URL and REDIS_PASSWORD. must supply config-name-or-path and port as options."
  )
  .requiredOption(
    "--config-name-or-path <string>",
    "config name or path to Nocturne contract JSON config file"
  )
  .requiredOption("--port <number>", "server port", parseInt)
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
    const { configNameOrPath, port, logDir, stdoutLogLevel } = options;
    const config = loadNocturneConfig(configNameOrPath);

    const supportedAssetRateLimits = new Map(
      Array.from(config.erc20s.values()).map((config) => [
        config.address,
        BigInt(config.globalCapWholeTokens) * 10n ** config.precision,
      ])
    );

    const logger = makeLogger(logDir, "bundler", "server", stdoutLogLevel);
    const server = new DepositScreenerServer(
      logger,
      getRedis(),
      // TODO: use real screening api and delay calculator
      new DummyScreeningApi(),
      new DummyScreenerDelayCalculator(),
      supportedAssetRateLimits
    );

    const { promise } = server.start(port);
    await promise;
  });

export default runServer;
