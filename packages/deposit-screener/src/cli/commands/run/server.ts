import { Command } from "commander";
import { DepositScreenerServer } from "../../../server";
import { makeLogger } from "@nocturne-xyz/offchain-utils";
import { getRedis } from "./utils";
import { loadNocturneConfig } from "@nocturne-xyz/config";
import { DummyScreeningApi, ScreeningApi } from "../../../screening";
import {
  DummyScreenerDelayCalculator,
  ScreenerDelayCalculator,
} from "../../../screenerDelay";

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
    "directory to write logs to",
    "./logs/deposit-screener"
  )
  .option(
    "--stdout-log-level <string>",
    "min log importance to log to stdout. if not given, logs will not be emitted to stdout"
  )
  .action(async (options) => {
    const env = process.env.ENVIRONMENT;
    if (!env) {
      throw new Error("ENVIRONMENT env var not set");
    }
    if (env !== "production" && env !== "development" && env !== "local") {
      throw new Error(`ENVIRONMENT env var set to invalid value: ${env}`);
    }

    const { configNameOrPath, port, logDir, stdoutLogLevel } = options;

    const config = loadNocturneConfig(configNameOrPath);

    const supportedAssetRateLimits = new Map(
      Array.from(config.erc20s.values()).map((config) => [
        config.address,
        BigInt(config.globalCapWholeTokens) * 10n ** config.precision,
      ])
    );

    let screeningApi: ScreeningApi;
    let screeningDelayCalculator: ScreenerDelayCalculator;
    if (env === "local" || env == "development") {
      const { dummyScreeningDelay } = options;
      screeningApi = new DummyScreeningApi();
      screeningDelayCalculator = new DummyScreenerDelayCalculator(
        dummyScreeningDelay
      );
    } else {
      throw new Error(`Not currently supporting non-dummy screening`);
    }

    console.log("making logger");
    const logger = makeLogger(
      logDir,
      "deposit-screener",
      "server",
      stdoutLogLevel
    );
    const server = new DepositScreenerServer(
      logger,
      getRedis(),
      // TODO: use real screening api and delay calculator
      screeningApi,
      screeningDelayCalculator,
      supportedAssetRateLimits
    );

    const { promise } = server.start(port);
    await promise;
  });

export default runServer;
