import { Command } from "commander";
import { ethers } from "ethers";
import { DepositScreenerScreener } from "../../../screener";
import { SubgraphScreenerSyncAdapter } from "../../../sync/subgraph/adapter";
import { makeLogger } from "@nocturne-xyz/offchain-utils";
import { loadNocturneConfig } from "@nocturne-xyz/config";
import { DepositScreenerFulfiller } from "../../../fulfiller";
import { DummyScreeningApi } from "../../../screening";
import { DummyScreenerDelayCalculator } from "../../../screenerDelay";
import { getRedis } from "./utils";

const runProcess = new Command("processor")
  .summary("process deposit requests")
  .description(
    "must supply the following environment variables: REDIS_URL, REDIS_PASSWORD, RPC_URL, and SUBGRAPH_URL. must supply config-name-or-path as option"
  )
  .requiredOption(
    "--config-name-or-path <string>",
    "deposit manager contract address"
  )
  .option(
    "--dummy-screening-delay <number>",
    "dummy screening delay in seconds"
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
    const {
      configNameOrPath,
      dummyScreeningDelay,
      logDir,
      throttleMs,
      stdoutLogLevel,
    } = options;

    const logger = makeLogger(
      logDir,
      "deposit-screener",
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

    const supportedAssets = new Set(
      Array.from(config.erc20s.values()).map(({ address }) => address)
    );

    const screener = new DepositScreenerScreener(
      adapter,
      config.depositManagerAddress(),
      provider,
      getRedis(),
      logger,
      // TODO: use real screening api and delay calculator
      new DummyScreeningApi(),
      new DummyScreenerDelayCalculator(dummyScreeningDelay),
      supportedAssets,
      config.contracts.startBlock
    );

    const fulfiller = new DepositScreenerFulfiller(
      logger,
      config.depositManagerAddress(),
      txSigner,
      attestationSigner,
      getRedis(),
      supportedAssets
    );

    const screenerHandle = await screener.start(throttleMs);
    const fulfillerHandle = await fulfiller.start();

    await Promise.all([screenerHandle.promise, fulfillerHandle.promise]);
  });

export default runProcess;
