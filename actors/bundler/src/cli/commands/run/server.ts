import { Command } from "commander";
import { ethers } from "ethers";
import { BundlerServer } from "../../../server";
import { makeLogger } from "@nocturne-xyz/offchain-utils";
import { getRedis } from "./utils";
import { extractConfigName, loadNocturneConfig } from "@nocturne-xyz/config";

const runServer = new Command("server")
  .summary("run bundler server")
  .description(
    "must supply .env file with REDIS_URL, REDIS_PASSWORD, and RPC_URL. must supply config-name-or-path and port as options."
  )
  .requiredOption(
    "--config-name-or-path <string>",
    "config name or path to Nocturne contract JSON config file"
  )
  .requiredOption("--port <number>", "server port", parseInt)
  .requiredOption("--bundler-address <string>", "bundler submitter address")
  .option(
    "--log-dir <string>",
    "directory to write logs to. if not given, logs will only be emitted to stdout."
  )
  .option("--log-level <string>", "min log importance to log to stdout.")
  .action(async (options) => {
    const { configNameOrPath, port, bundlerAddress, logDir, logLevel } =
      options;
    const config = loadNocturneConfig(configNameOrPath);

    const rpcUrl = process.env.RPC_URL;
    if (!rpcUrl) {
      throw new Error("missing RPC_URL");
    }
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);

    const configName = extractConfigName(configNameOrPath);
    const logger = makeLogger(
      configName,
      "bundler",
      "server",
      logLevel,
      logDir
    );

    const server = new BundlerServer(
      bundlerAddress,
      config.tellerAddress,
      config.handlerAddress,
      provider,
      getRedis(),
      logger
    );

    const { promise } = server.start(port);
    await promise;
  });

export default runServer;
