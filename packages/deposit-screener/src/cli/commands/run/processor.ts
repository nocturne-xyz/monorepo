import { Command } from "commander";
import { ethers } from "ethers";
import { DepositScreenerProcessor } from "../../../processor";
import { SubgraphScreenerSyncAdapter } from "../../../sync/subgraph/adapter";
import { getRedis } from "../utils";

const runProcess = new Command("processor")
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
    const txSignerKey = process.env.TX_SIGNER_KEY;
    if (!txSignerKey) {
      throw new Error("Missing TX_SIGNER_KEY");
    }
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    const txSigner = new ethers.Wallet(txSignerKey, provider);

    const attestationSignerKey = process.env.ATTESTATION_SIGNER_KEY;
    if (!attestationSignerKey) {
      throw new Error("Missing ATTESTATION_SIGNER_KEY");
    }
    const attestationSigner = new ethers.Wallet(attestationSignerKey);

    const processor = new DepositScreenerProcessor(
      adapter,
      depositManagerAddress,
      attestationSigner,
      txSigner,
      getRedis()
    );

    const [prom] = await processor.start();
    await prom;
  });

export default runProcess;
