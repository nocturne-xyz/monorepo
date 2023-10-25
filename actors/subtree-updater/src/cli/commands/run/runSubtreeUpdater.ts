import { Command } from "commander";
import { SubtreeUpdater } from "../../../subtreeUpdater";
import { getRedis } from "../utils";
import {
  makeLogger,
  getEthersProviderAndSignerFromEnvConfiguration,
} from "@nocturne-xyz/offchain-utils";
import { extractConfigName, loadNocturneConfig } from "@nocturne-xyz/config";
import { Handler__factory } from "@nocturne-xyz/contracts";
import {
  MockSubtreeUpdateProver,
  SubtreeUpdateProver,
  assertOrErr,
} from "@nocturne-xyz/core";
import { RapidsnarkSubtreeUpdateProver } from "../../../rapidsnarkProver";

export const runSubtreeUpdater = new Command("subtree-updater")
  .summary("run subtree updater service")
  .description(
    "must supply .env file with REDIS_URL, RPC_URL, TX_SIGNER_KEY, and SUBGRAPH_URL"
  )
  .requiredOption(
    "--config-name-or-path <string>",
    "deposit manager contract address"
  )
  .option(
    "--use-mock-prover",
    "use mock prover to generate proofs instead of rapidsnark. If false, must supply --rapidsnark-executable-path, --witness-generator-path, --zkey-path, and --vkey-path.",
    false
  )
  .option(
    "--rapidsnark-executable-path <string>",
    "path to rapidsnark executable"
  )
  .option("--witness-generator-path <string>", "path to witness generator")
  .option("--zkey-path <string>", "path to zkey")
  .option("--vkey-path <string>", "path to vkey")
  .option(
    "--tmp-dir <string>",
    "optional path to use for witness / proof files for rapdisnark"
  )
  .option(
    "--fill-batch-latency-ms <number>",
    "maximum period of time to wait before force-filling a batch with zeros on-chain",
    parseInt
  )
  .option(
    "--log-dir <string>",
    "directory to write logs to",
    "./logs/subtree-updater"
  )
  .option(
    "--log-level <string>",
    "min log importance to log to stdout. if not given, logs will not be emitted to stdout"
  )
  .action(async (options) => {
    const {
      configNameOrPath,
      logDir,
      useMockProver,
      fillBatchLatencyMs,
      rapidsnarkExecutablePath,
      witnessGeneratorPath,
      zkeyPath,
      vkeyPath,
      logLevel,
    } = options;

    const configName = extractConfigName(configNameOrPath);
    const logger = makeLogger(
      logDir,
      `${configName}-subtree-updater`,
      "subtree-updater",
      logLevel
    );

    const config = loadNocturneConfig(configNameOrPath);
    logger.info("config", { config });

    // TODO: enable switching on adapter impl
    const subgraphEndpoint = process.env.SUBGRAPH_URL;
    if (!subgraphEndpoint) {
      throw new Error("missing SUBGRAPH_URL");
    }

    const { signer } = getEthersProviderAndSignerFromEnvConfiguration();

    const handlerContract = Handler__factory.connect(
      config.handlerAddress,
      signer
    );

    const fillBatchLatency = fillBatchLatencyMs
      ? (fillBatchLatencyMs as number)
      : undefined;

    let prover: SubtreeUpdateProver;
    if (useMockProver) {
      logger.info("using mock prover");
      prover = new MockSubtreeUpdateProver();
    } else {
      logger.info("using rapidsnark prover");
      assertOrErr(
        rapidsnarkExecutablePath,
        "rapidsnark executable path must be specified when not using mock prover"
      );
      assertOrErr(
        witnessGeneratorPath,
        "witness generator path must be specified when not using mock prover"
      );
      assertOrErr(
        zkeyPath,
        "zkey path must be specified when not using mock prover"
      );
      assertOrErr(
        vkeyPath,
        "vkey path must be specified when not using mock prover"
      );

      prover = new RapidsnarkSubtreeUpdateProver(
        rapidsnarkExecutablePath,
        witnessGeneratorPath,
        zkeyPath,
        vkeyPath
      );
    }

    const updater = new SubtreeUpdater(
      handlerContract,
      logger,
      getRedis(),
      prover,
      subgraphEndpoint,
      { fillBatchLatency }
    );

    const { promise } = await updater.start();
    await promise;
  });
