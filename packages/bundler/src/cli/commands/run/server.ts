import { Command } from "commander";
import { ethers } from "ethers";
import { BundlerServer } from "../../../server";
import { getRedis } from "../../utils";
import { makeLogger } from "@nocturne-xyz/offchain-utils";

const runServer = new Command("server")
  .summary("run bundler server")
  .description(
    "must supply .env file with REDIS_URL and RPC_URL. must supply wallet contract address and port as options."
  )
  .requiredOption("--wallet-address <string>", "wallet contract address")
  .requiredOption("--port <number>", "server port", parseInt)
  .option(
    "--log-dir <string>",
    "directory to write logs to",
    "./logs/bundler-server"
  )
  .action(async (options) => {
    const { walletAddress, port, logDir } = options;

    const rpcUrl = process.env.RPC_URL;
    if (!rpcUrl) {
      throw new Error("missing RPC_URL");
    }
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);

    const logger = makeLogger(logDir, "bundler", "server");
    const server = new BundlerServer(
      walletAddress,
      provider,
      getRedis(),
      logger
    );
    server.start(port);
  });

export default runServer;
