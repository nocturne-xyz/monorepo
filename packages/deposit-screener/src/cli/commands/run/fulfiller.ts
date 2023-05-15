import { Command } from "commander";
import { ethers } from "ethers";
import { getRedis } from "../utils";
import { makeLogger } from "@nocturne-xyz/offchain-utils";
import { loadNocturneConfig } from "@nocturne-xyz/config";
import { DepositScreenerFulfiller } from "../../../fulfiller";

const runFulfiller = new Command("fulfiller")
  .summary("fulfill deposit requests")
  .description(
    "must supply the following environment variables: REDIS_URL, RPC_URL, TX_SIGNER_KEY, and ATTESTATION_SIGNER_KEY. must supply conifig via `--config-path-or-name`"
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
    "--stdout-log-level <string>",
    "min log importance to log to stdout. if not given, logs will not be emitted to stdout"
  )
  .action(async (options) => {
    const { configNameOrPath, logDir, stdoutLogLevel } = options;
    const config = loadNocturneConfig(configNameOrPath);
    console.log(config);

    const rpcUrl = process.env.RPC_URL;
    if (!rpcUrl) {
      throw new Error("missing RPC_URL");
    }
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);

    const txSignerKey = process.env.TX_SIGNER_KEY;
    if (!txSignerKey) {
      throw new Error("missing TX_SIGNER_KEY");
    }
    const txSigner = new ethers.Wallet(txSignerKey, provider);

    const attestationSignerKey = process.env.ATTESTATION_SIGNER_KEY;
    if (!attestationSignerKey) {
      throw new Error("missing ATTESTATION_SIGNER_KEY");
    }
    const attestationSigner = new ethers.Wallet(attestationSignerKey);

    const fulfiller = new DepositScreenerFulfiller(
      config.depositManagerAddress(),
      txSigner,
      attestationSigner,
      getRedis(),
      config.erc20s
    );

    const logger = makeLogger(
      logDir,
      "deposit-screener",
      "processor",
      stdoutLogLevel
    );

    const { promise } = await fulfiller.start(logger);
    await promise;
  });

export default runFulfiller;
