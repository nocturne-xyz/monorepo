import { Command } from "commander";
import { ethers } from "ethers";
import { DepositScreenerProcessor } from "../../../processor";
import { SubgraphScreenerSyncAdapter } from "../../../sync/subgraph/adapter";
import { getRedis } from "../utils";
import { makeLogger } from "@nocturne-xyz/offchain-utils";
import { loadNocturneConfig } from "@nocturne-xyz/config";

const runProcess = new Command("processor")
  .summary("process deposit requests")
  .description(
    "must supply .env file with REDIS_URL, RPC_URL, TX_SIGNER_KEY, and SUBGRAPH_URL. must supply deposit manager contract address as options."
  )
  .requiredOption(
    "--config-name-or-path <string>",
    "deposit manager contract address"
  )
  .option(
    "--log-dir <string>",
    "directory to write logs to",
    "./logs/deposit-screener-processor"
  )
  .option(
    "--throttle-ms <number>",
    "maximum period of time to wait before pulling new deposit events",
    parseInt
  )
  .option(
    "--stdout-log-level <string>",
    "min log importance to log to stdout. if not given, logs will not be emitted to stdout"
  )
  .action(async (options) => {
    const { configNameOrPath, logDir, throttleMs, stdoutLogLevel } = options;
    const config = loadNocturneConfig(configNameOrPath);

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

    const logger = makeLogger(
      logDir,
      "deposit-screener",
      "processor",
      stdoutLogLevel
    );
    const processor = new DepositScreenerProcessor(
      adapter,
      config.depositManagerAddress(),
      attestationSigner,
      txSigner,
      getRedis(),
      logger,
      config.erc20s,
      config.contracts.startBlock
    );

    const { promise } = await processor.start(throttleMs);
    await promise;
  });

export default runProcess;
