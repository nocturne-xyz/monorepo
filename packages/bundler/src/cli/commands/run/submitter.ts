import { Command } from "commander";
import { ethers } from "ethers";
import { BundlerSubmitter } from "../../../submitter";
import { getRedis } from "../../utils";
import { makeLogger } from "@nocturne-xyz/offchain-utils";
import { loadNocturneConfig } from "@nocturne-xyz/config";

const runSubmitter = new Command("submitter")
  .summary("run bundler submitter")
  .description(
    "must supply .env file with REDIS_URL, RPC_URL, and TX_SIGNER_KEY. must also supply teller contract address as an option."
  )
  .requiredOption(
    "--config-name-or-path <string>",
    "config name or path to Nocturne contract JSON config file"
  )
  .option(
    "--log-dir <string>",
    "directory to write logs to",
    "./logs/bundler-submitter"
  )
  .option(
    "--stdout-log-level",
    "min log importance to log to stdout. if not given, logs will not be emitted to stdout"
  )
  .action(async (options) => {
    const { configNameOrPath, logDir, stdoutLogLevel } = options;
    const config = loadNocturneConfig(configNameOrPath);

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

    const logger = makeLogger(logDir, "bundler", "submitter", stdoutLogLevel);
    const submitter = new BundlerSubmitter(
      config.tellerAddress(),
      signingProvider,
      getRedis(),
      logger
    );

    const { promise } = submitter.start();
    await promise;
  });

export default runSubmitter;
