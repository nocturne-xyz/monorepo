import { Command } from "commander";
import { ethers } from "ethers";
import { DepositScreenerProcessor } from "../../../processor";
import { DepositScreenerSubmitter } from "../../../submitter";
import { SubgraphScreenerSyncAdapter } from "../../../sync/subgraph/adapter";

const runProcess = new Command("process")
  .summary("Process deposit requests")
  .description(
    "Must supply .env file with REDIS_URL, RPC_URL, TX_SIGNER_KEY, and SUBGRAPH_ENDPOINT. Must supply deposit manager contract address as options."
  )
  .requiredOption(
    "--deposit-manager-address <string>",
    "deposit manager contract address"
  )
  .action(async (options) => {
    const { depositManagerAddress } = options;

    // TODO: enable switching on adapter impl
    const subgraphEndpoint = process.env.SUGRAPH_ENDPOINT;
    if (!subgraphEndpoint) {
      throw new Error("Missing SUBGRAPH_ENDPOINT");
    }
    const adapter = new SubgraphScreenerSyncAdapter(subgraphEndpoint);

    const rpcUrl = process.env.RPC_URL;
    if (!rpcUrl) {
      throw new Error("Missing RPC_URL");
    }
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);

    const processor = new DepositScreenerProcessor(
      adapter,
      depositManagerAddress,
      provider
    );
    const submitter = new DepositScreenerSubmitter(depositManagerAddress);

    await Promise.all([processor.run(), submitter.run()]);
  });

export default runProcess;
