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

    const ozApiKey = process.env.OZ_API_KEY;
    const ozApiSecret = process.env.OZ_API_SECRET;

    const privateKey = process.env.TX_SIGNER_KEY;
    const rpcUrl = process.env.RPC_URL;

    let signer: ethers.Signer;
    if (ozApiKey && ozApiSecret) {
      const credentials = {
        apiKey: ozApiKey,
        apiSecret: ozApiSecret,
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
        "missing RPC_URL/PRIVATE_KEY or OZ_API_KEY/OZ_API_SECRET"
      );
    }

    const logger = makeLogger(logDir, "bundler", "submitter", stdoutLogLevel);
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
