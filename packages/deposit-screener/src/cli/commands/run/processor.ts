import { Command } from "commander";
import { ethers } from "ethers";
import { DepositScreenerProcessor } from "../../../processor";
import { SubgraphScreenerSyncAdapter } from "../../../sync/subgraph/adapter";
import { getRedis } from "../utils";

const runProcess = new Command("process")
  .summary("Process deposit requests")
  .description(
    "Must supply .env file with REDIS_URL, RPC_URL, TX_SIGNER_KEY, and SUBGRAPH_URL. Must supply deposit manager contract address as options."
  )
  .requiredOption(
    "--deposit-manager-address <string>",
    "deposit manager contract address"
  )
  .action(async (options) => {
    const { depositManagerAddress } = options;

    // TODO: enable switching on adapter impl
    const subgraphEndpoint = process.env.SUBGRAPH_URL;
    if (!subgraphEndpoint) {
      throw new Error("Missing SUBGRAPH_URL");
    }
    const adapter = new SubgraphScreenerSyncAdapter(subgraphEndpoint);

    const rpcUrl = process.env.RPC_URL;
    if (!rpcUrl) {
      throw new Error("Missing RPC_URL");
    }

    const privateKey = process.env.TX_SIGNER_KEY;
    if (!privateKey) {
      throw new Error("Missing TX_SIGNER_KEY");
    }

    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    const signingProvider = new ethers.Wallet(privateKey, provider);

    const processor = new DepositScreenerProcessor(
      adapter,
      depositManagerAddress,
      signingProvider,
      getRedis()
    );

    await processor.run();
  });

export default runProcess;
