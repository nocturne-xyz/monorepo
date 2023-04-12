import { Command } from "commander";
import { ethers } from "ethers";
import { DepositScreenerProcessor } from "../../../processor";
import { SubgraphScreenerSyncAdapter } from "../../../sync/subgraph/adapter";
import { getRedis, makeLogger } from "../utils";

const runProcess = new Command("processor")
  .summary("process deposit requests")
  .description(
    "must supply .env file with REDIS_URL, RPC_URL, TX_SIGNER_KEY, and SUBGRAPH_URL. must supply deposit manager contract address as options."
  )
  .requiredOption(
    "--deposit-manager-address <string>",
    "deposit manager contract address"
  )
  .option(
    "--log-dir <string>",
    "directory to write logs to",
    "./logs/deposit-screener-processor"
  )
  .action(async (options) => {
    const { depositManagerAddress, logDir } = options;

    // TODO: enable switching on adapter impl
    const subgraphEndpoint = process.env.SUBGRAPH_URL;
    if (!subgraphEndpoint) {
      throw new Error("missing SUBGRAPH_URL");
    }
    const adapter = new SubgraphScreenerSyncAdapter(subgraphEndpoint);

    const rpcUrl = process.env.RPC_URL;
    if (!rpcUrl) {
      throw new Error("missing RPC_URL");
    }
    const txSignerKey = process.env.TX_SIGNER_KEY;
    if (!txSignerKey) {
      throw new Error("missing TX_SIGNER_KEY");
    }
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    const txSigner = new ethers.Wallet(txSignerKey, provider);

    const attestationSignerKey = process.env.ATTESTATION_SIGNER_KEY;
    if (!attestationSignerKey) {
      throw new Error("missing ATTESTATION_SIGNER_KEY");
    }
    const attestationSigner = new ethers.Wallet(attestationSignerKey);

    const logger = makeLogger(logDir, "processor");
    const processor = new DepositScreenerProcessor(
      adapter,
      depositManagerAddress,
      attestationSigner,
      txSigner,
      getRedis(),
      logger
    );

    const { promise } = await processor.start();
    await promise;
  });

export default runProcess;
