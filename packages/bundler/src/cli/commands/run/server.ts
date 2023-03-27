import { Command } from "commander";
import { ethers } from "ethers";
import { BundlerServer } from "../../../server";
import { getRedis } from "../../utils";

const runServer = new Command("server")
  .summary("Run bundler server")
  .description(
    "Must supply .env file with REDIS_URL and RPC_URL. Must supply wallet contract address and port as options."
  )
  .requiredOption("--wallet-address <string>", "wallet contract address")
  .requiredOption("--port <number>", "server port", parseInt)
  .action(async (options) => {
    const { walletAddress, port } = options;

    const rpcUrl = process.env.RPC_URL;
    if (!rpcUrl) {
      throw new Error("Missing RPC_URL");
    }
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);

    const server = new BundlerServer(walletAddress, provider, getRedis());
    server.start(port);
  });

export default runServer;
