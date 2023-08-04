import { Command } from "commander";
import { ethers } from "ethers";
import { BundlerSubmitter } from "../../../submitter";
import { makeLogger } from "@nocturne-xyz/offchain-utils";
import { getRedis } from "./utils";
import { loadNocturneConfig } from "@nocturne-xyz/config";
import {
  DefenderRelayProvider,
  DefenderRelaySigner,
} from "@openzeppelin/defender-relay-client/lib/ethers";

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
  .action(async (options) => {
    const { configNameOrPath, logDir, stdoutLogLevel } = options;
    const config = loadNocturneConfig(configNameOrPath);

    const relayerApiKey = process.env.OZ_RELAYER_API_KEY;
    const relayerApiSecret = process.env.OZ_RELAYER_API_SECRET;

    const privateKey = process.env.TX_SIGNER_KEY;
    const rpcUrl = process.env.RPC_URL;

    let signer: ethers.Signer;
    if (relayerApiKey && relayerApiSecret) {
      const credentials = {
        apiKey: relayerApiKey,
        apiSecret: relayerApiSecret,
      };
      const provider = new DefenderRelayProvider(credentials);
      signer = new DefenderRelaySigner(credentials, provider, {
        speed: "average",
      });
    } else if (rpcUrl && privateKey) {
      const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
      signer = new ethers.Wallet(privateKey, provider);
    } else {
      throw new Error(
        "missing RPC_URL/PRIVATE_KEY or OZ_RELAYER_API_KEY/OZ_RELAYER_API_SECRET"
      );
    }

    const logger = makeLogger(
      logDir,
      "testnet2-bundler",
      "submitter",
      stdoutLogLevel
    );
    const submitter = new BundlerSubmitter(
      config.tellerAddress(),
      signer,
      getRedis(),
      logger
    );

    const { promise } = submitter.start();
    await promise;
  });

export default runSubmitter;
