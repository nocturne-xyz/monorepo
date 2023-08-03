import { Command } from "commander";
import { ethers } from "ethers";
import { BundlerSubmitter } from "../../../submitter";
import { makeLogger } from "@nocturne-xyz/offchain-utils";
import { getRedis } from "./utils";
import { loadNocturneConfig } from "@nocturne-xyz/config";
import { RelayClient } from "@openzeppelin/defender-relay-client";
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
    const ozRelayerAddress = process.env.OZ_RELAYER_ADDRESS;

    const privateKey = process.env.TX_SIGNER_KEY;
    const rpcUrl = process.env.RPC_URL;

    let signer: ethers.Signer;
    if (ozApiKey && ozApiSecret) {
      const credentials = {
        apiKey: ozApiKey,
        apiSecret: ozApiSecret,
      };
      const relayClient = new RelayClient(credentials);
      const relayerResponse = (await relayClient.list()).items.find(
        (r) => r.address === ozRelayerAddress
      );

      if (!relayerResponse) {
        throw new Error("No relayer with address " + ozRelayerAddress);
      }

      let relayerApiKey: string;
      let relayerSecretKey: string;

      const keys = await relayClient.listKeys(relayerResponse.relayerId);
      if (keys.length > 0 && keys[0].secretKey) {
        relayerApiKey = keys[0].apiKey;
        relayerSecretKey = keys[0].secretKey;
      } else {
        const relayerKeyResponse = await relayClient.createKey(
          relayerResponse.relayerId
        );
        if (!relayerKeyResponse.secretKey) {
          throw new Error(
            `No secret key returned for relayer with id: ${relayerResponse.relayerId}}`
          );
        }

        relayerApiKey = relayerKeyResponse.apiKey;
        relayerSecretKey = relayerKeyResponse.secretKey;
      }

      const provider = new DefenderRelayProvider({
        apiKey: relayerApiKey,
        apiSecret: relayerSecretKey,
      });
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
