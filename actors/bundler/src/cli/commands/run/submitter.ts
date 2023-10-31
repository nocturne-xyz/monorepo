import { Command } from "commander";
import { BundlerSubmitter } from "../../../submitter";
import {
  makeLogger,
  getEthersProviderAndSignerFromEnvConfiguration,
} from "@nocturne-xyz/offchain-utils";
import { getRedis } from "./utils";
import { extractConfigName, loadNocturneConfig } from "@nocturne-xyz/config";

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
    "directory to write logs to. if not given, logs will only be emitted to stdout."
  )
  .option("--log-level <string>", "min log importance to log to stdout.")
  .option(
    "--finality-blocks <number>",
    "number of confirmations to wait for before considering a submitted op finalized",
    parseInt
  )
  .action(async (options) => {
    const { configNameOrPath, logDir, logLevel, finalityBlocks } = options;
    const config = loadNocturneConfig(configNameOrPath);

    const { signer } = getEthersProviderAndSignerFromEnvConfiguration();

    const configName = extractConfigName(configNameOrPath);
    const logger = makeLogger(
      configName,
      "bundler",
      "submitter",
      logLevel,
      logDir
    );
    const submitter = new BundlerSubmitter(
      config.tellerAddress,
      signer,
      getRedis(),
      logger,
      finalityBlocks ?? config.offchain.finalityBlocks
    );

    const { promise } = submitter.start();
    await promise;
  });

export default runSubmitter;
