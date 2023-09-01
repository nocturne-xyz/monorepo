import { Command } from "commander";
import { ethers } from "ethers";
import { DepositScreenerScreener } from "../../../screener";
import { SubgraphScreenerSyncAdapter } from "../../../sync/subgraph/adapter";
import { makeLogger } from "@nocturne-xyz/offchain-utils";
import { extractConfigName, loadNocturneConfig } from "@nocturne-xyz/config";
import { DepositScreenerFulfiller } from "../../../fulfiller";
import { DummyScreeningApi, ScreeningCheckerApi } from "../../../screening";
import {
  DummyScreenerDelayCalculator,
  ScreenerDelayCalculator,
} from "../../../screenerDelay";
import { getRedis } from "./utils";
import {
  DefenderRelayProvider,
  DefenderRelaySigner,
} from "@openzeppelin/defender-relay-client/lib/ethers";

const runProcess = new Command("processor")
  .summary("process deposit requests")
  .description(
    "must supply the following environment variables: ENVIRONMENT, REDIS_URL, REDIS_PASSWORD, RPC_URL, and SUBGRAPH_URL. must supply config-name-or-path as option"
  )
  .requiredOption(
    "--config-name-or-path <string>",
    "deposit manager contract address"
  )
  .option(
    "--dummy-screening-delay <number>",
    "dummy screening delay in seconds (test purposes only)"
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
    const env = process.env.ENVIRONMENT;
    if (!env) {
      throw new Error("ENVIRONMENT env var not set");
    }
    if (env !== "production" && env !== "development" && env !== "local") {
      throw new Error(`ENVIRONMENT env var set to invalid value: ${env}`);
    }

    const { configNameOrPath, logDir, throttleMs, stdoutLogLevel } = options;

    const configName = extractConfigName(configNameOrPath);
    const logger = makeLogger(
      logDir,
      `${configName}-deposit-screener`,
      "processor",
      stdoutLogLevel
    );

    const config = loadNocturneConfig(configNameOrPath);
    logger.info("config", { config });

    // TODO: enable switching on adapter impl
    const subgraphEndpoint = process.env.SUBGRAPH_URL;
    if (!subgraphEndpoint) {
      throw new Error("missing SUBGRAPH_URL");
    }
    const adapter = new SubgraphScreenerSyncAdapter(
      subgraphEndpoint,
      logger.child({ function: "SubgraphScreenerSyncAdapter" })
    );

    const relayerApiKey = process.env.OZ_RELAYER_API_KEY;
    const relayerApiSecret = process.env.OZ_RELAYER_API_SECRET;

    const privateKey = process.env.TX_SIGNER_KEY;
    const rpcUrl = process.env.RPC_URL;

    let provider: ethers.providers.Provider;
    let signer: ethers.Signer;
    if (relayerApiKey && relayerApiSecret) {
      const credentials = {
        apiKey: relayerApiKey,
        apiSecret: relayerApiSecret,
      };
      provider = new DefenderRelayProvider(credentials);
      signer = new DefenderRelaySigner(credentials, provider, {
        speed: "average",
      });
    } else if (rpcUrl && privateKey) {
      provider = new ethers.providers.JsonRpcProvider(rpcUrl);
      signer = new ethers.Wallet(privateKey, provider);
    } else {
      throw new Error(
        "missing RPC_URL/PRIVATE_KEY or OZ_RELAYER_API_KEY/OZ_RELAYER_API_SECRET"
      );
    }

    const attestationSignerKey = process.env.ATTESTATION_SIGNER_KEY;
    if (!attestationSignerKey) {
      throw new Error("missing ATTESTATION_SIGNER_KEY");
    }
    const attestationSigner = new ethers.Wallet(attestationSignerKey);

    const supportedAssets = new Set(
      Array.from(config.erc20s.values()).map(({ address }) => address)
    );

    let screeningApi: ScreeningCheckerApi;
    let screeningDelayCalculator: ScreenerDelayCalculator;
    if (env === "local" || env == "development") {
      const { dummyScreeningDelay } = options;
      screeningApi = new DummyScreeningApi();
      screeningDelayCalculator = new DummyScreenerDelayCalculator(
        dummyScreeningDelay
      );
    } else {
      throw new Error(`Not currently supporting non-dummy screening`);
    }

    const screener = new DepositScreenerScreener(
      adapter,
      config.depositManagerAddress(),
      provider,
      getRedis(),
      logger,
      // TODO: use real screening api and delay calculator
      screeningApi,
      screeningDelayCalculator,
      supportedAssets,
      config.contracts.startBlock
    );

    const fulfiller = new DepositScreenerFulfiller(
      logger,
      config.depositManagerAddress(),
      signer,
      attestationSigner,
      getRedis(),
      supportedAssets
    );

    const screenerHandle = await screener.start(throttleMs);
    const fulfillerHandle = await fulfiller.start();

    await Promise.all([screenerHandle.promise, fulfillerHandle.promise]);
  });

export default runProcess;
