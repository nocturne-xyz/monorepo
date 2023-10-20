import { extractConfigName, loadNocturneConfig } from "@nocturne-xyz/config";
import { makeLogger } from "@nocturne-xyz/offchain-utils";
import { Command } from "commander";
import {
  ConcreteScreeningChecker,
  DummyScreeningApi,
  ScreeningCheckerApi,
} from "../../../screening";
import { DepositScreenerServer } from "../../../server";
import { getRedis } from "./utils";
import { createPool } from "@nocturne-xyz/offchain-utils/dist/src/db";

const runServer = new Command("server")
  .summary("run deposit screener server")
  .description(
    "must supply .env file with ENVIRONMENT, REDIS_URL, and REDIS_PASSWORD. must supply config-name-or-path and port as options."
  )
  .requiredOption(
    "--config-name-or-path <string>",
    "config name or path to Nocturne contract JSON config file"
  )
  .requiredOption("--port <number>", "server port", parseInt)
  .option(
    "--dummy-screening-delay <number>",
    "dummy screening delay in seconds (test purposes only)"
  )
  .option(
    "--log-dir <string>",
    "directory to write logs to. if not given, logs will only be emitted to stdout."
  )
  .option("--log-level <string>", "min log importance to log to stdout.")
  .action(async (options) => {
    const env = process.env.ENVIRONMENT;
    if (!env) {
      throw new Error("ENVIRONMENT env var not set");
    }
    if (env !== "production" && env !== "development" && env !== "local") {
      throw new Error(`ENVIRONMENT env var set to invalid value: ${env}`);
    }

    const { configNameOrPath, port, logDir, logLevel } = options;

    const configName = extractConfigName(configNameOrPath);
    const logger = makeLogger(
      configName,
      "deposit-screener",
      "server",
      logLevel,
      logDir
    );

    const config = loadNocturneConfig(configNameOrPath);

    const supportedAssetRateLimits = new Map(
      Array.from(config.erc20s.values()).map((config) => [
        config.address,
        BigInt(config.globalCapWholeTokens) * 10n ** config.precision,
      ])
    );

    const redis = getRedis();
    let screeningApi: ScreeningCheckerApi;
    if (env === "local" || env == "development") {
      logger.info("Configuring dummy screening api");
      const { dummyScreeningDelay } = options;
      screeningApi = new DummyScreeningApi(dummyScreeningDelay);
    } else {
      logger.info("Configuring real screening api");
      screeningApi = new ConcreteScreeningChecker(redis, logger);
    }

    const server = new DepositScreenerServer(
      logger,
      redis,
      createPool(),
      screeningApi,
      supportedAssetRateLimits
    );

    const { promise } = server.start(port);
    await promise;
  });

export default runServer;
