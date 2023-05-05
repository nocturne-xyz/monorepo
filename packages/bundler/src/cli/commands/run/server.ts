import { Command } from "commander";
import { ethers } from "ethers";
import { BundlerServer } from "../../../server";
import { getRedis } from "../../utils";
import { makeLogger } from "@nocturne-xyz/offchain-utils";
import { loadNocturneConfig } from "@nocturne-xyz/config";

const runServer = new Command("server")
  .summary("run bundler server")
  .description(
    "must supply .env file with REDIS_URL and RPC_URL. must supply teller contract address and port as options."
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

    const rpcUrl = process.env.RPC_URL;
    if (!rpcUrl) {
      throw new Error("missing RPC_URL");
    }
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);

    const logger = makeLogger(logDir, "bundler", "server", stdoutLogLevel);
    const server = new BundlerServer(
      config.tellerAddress(),
      provider,
      getRedis(),
      logger
    );
    server.start(port);
  });

export default runServer;
