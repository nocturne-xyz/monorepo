import { Command } from "commander";
import { BundlerSubmitter } from "../../../submitter";
import { makeLogger } from "@nocturne-xyz/offchain-utils";
import { getRedis } from "./utils";
import { extractConfigName, loadNocturneConfig } from "@nocturne-xyz/config";
import { getEthersProviderAndSignerFromEnvConfiguration } from "@nocturne-xyz/offchain-utils/dist/src/ethersHelpers";

const runSubmitter = new Command("submitter")
  .summary("run bundler submitter")
  .description(
    "must supply .env file with REDIS_URL,REDIS_PASSWORD, RPC_URL, and TX_SIGNER_KEY. must also supply configPathOrName as an option."
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
    "--stdout-log-level <string>",
    "min log importance to log to stdout. if not given, logs will not be emitted to stdout"
  )
  .option(
    "--finality-blocks <number>",
    "number of confirmations to wait for before considering a submitted op finalized",
    parseInt
  )
  .action(async (options) => {
    const { configNameOrPath, logDir, stdoutLogLevel, finalityBlocks } =
      options;
    const config = loadNocturneConfig(configNameOrPath);

    const { signer } = getEthersProviderAndSignerFromEnvConfiguration();

    const configName = extractConfigName(configNameOrPath);
    const logger = makeLogger(
      logDir,
      `${configName}-bundler`,
      "submitter",
      stdoutLogLevel
    );
    const submitter = new BundlerSubmitter(
      config.tellerAddress,
      signer,
      getRedis(),
      logger,
      finalityBlocks ?? config.finalityBlocks
    );

    const { promise } = submitter.start();
    await promise;
  });

export default runSubmitter;
