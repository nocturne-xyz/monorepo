import { Command } from "commander";
import { ethers } from "ethers";
import { BundlerSubmitter } from "../../../submitter";
import { getRedis, makeLogger } from "../../utils";

const runSubmitter = new Command("submitter")
  .summary("run bundler submitter")
  .description(
    "must supply .env file with REDIS_URL, RPC_URL, and TX_SIGNER_KEY. must also supply wallet contract address as an option."
  )
  .requiredOption("--wallet-address <string>", "wallet contract address")
  .option(
    "--log-dir <string>",
    "directory to write logs to",
    "./logs/bundler-submitter"
  )
  .action(async (options) => {
    const { walletAddress, logDir } = options;

    const privateKey = process.env.TX_SIGNER_KEY;
    if (!privateKey) {
      throw new Error("missing TX_SIGNER_KEY");
    }

    const rpcUrl = process.env.RPC_URL;
    if (!rpcUrl) {
      throw new Error("missing RPC_URL");
    }
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    const signingProvider = new ethers.Wallet(privateKey, provider);

    const logger = makeLogger(logDir, "submitter");
    const submitter = new BundlerSubmitter(
      walletAddress,
      signingProvider,
      getRedis(),
      logger
    );

    const { promise } = submitter.start();
    await promise;
  });

export default runSubmitter;
