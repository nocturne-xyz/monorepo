import { Command } from "commander";
import { BundlerServer } from "../../../server";

const runServer = new Command("server")
  .summary("Run the bundler server")
  .description(
    "Must supply .env file with REDIS_URL and RPC_URL. Must supply wallet address and port as options."
  )
  .requiredOption("--wallet-address <address>", "wallet address")
  .requiredOption("--port <number>", "server port")
  .action(async (options) => {
    const { walletAddress, port } = options;
    const server = new BundlerServer(walletAddress);
    await server.run(port);
  });

export default runServer;
