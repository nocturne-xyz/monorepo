import { Command } from "commander";
import { BundlerSubmitter } from "../../../submitter";

const runSubmitter = new Command("submitter")
  .summary("Run bundler submitter")
  .description(
    "Must supply .env file with REDIS_URL, RPC_URL, and TX_SIGNER_KEY. Must also supply wallet contract address as an option."
  )
  .requiredOption("--wallet-address <string>", "wallet contract address")
  .action(async (options) => {
    const { walletAddress } = options;
    const submitter = new BundlerSubmitter(walletAddress);
    await submitter.run();
  });

export default runSubmitter;
