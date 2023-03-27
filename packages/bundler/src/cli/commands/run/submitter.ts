import { Command } from "commander";
import { ethers } from "ethers";
import { BundlerSubmitter } from "../../../submitter";
import { getRedis } from "../../utils";

const runSubmitter = new Command("submitter")
  .summary("Run bundler submitter")
  .description(
    "Must supply .env file with REDIS_URL, RPC_URL, and TX_SIGNER_KEY. Must also supply wallet contract address as an option."
  )
  .requiredOption("--wallet-address <string>", "wallet contract address")
  .action(async (options) => {
    const { walletAddress } = options;

    const privateKey = process.env.TX_SIGNER_KEY;
    if (!privateKey) {
      throw new Error("Missing TX_SIGNER_KEY");
    }

    const rpcUrl = process.env.RPC_URL;
    if (!rpcUrl) {
      throw new Error("Missing RPC_URL");
    }
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    const signingProvider = new ethers.Wallet(privateKey, provider);

    const submitter = new BundlerSubmitter(
      walletAddress,
      signingProvider,
      getRedis()
    );
    const [prom] = submitter.start();
    await prom;
  });

export default runSubmitter;
