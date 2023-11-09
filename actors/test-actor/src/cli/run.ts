import { extractConfigName, loadNocturneConfig } from "@nocturne-xyz/config";
import {
  DepositManager__factory,
  Teller__factory,
} from "@nocturne-xyz/contracts";
import { SparseMerkleProver, NocturneSigner } from "@nocturne-xyz/core";
import {
  NocturneClient,
  NocturneDB,
  MockEthToTokenConverter,
  BundlerOpTracker,
} from "@nocturne-xyz/client";
import { WasmJoinSplitProver } from "@nocturne-xyz/local-prover";
import { Command } from "commander";
import { ethers } from "ethers";
import { TestActor } from "../actor";
import * as fs from "fs";
import {
  makeLogger,
  getEthersProviderAndSignerFromEnvConfiguration,
} from "@nocturne-xyz/offchain-utils";
import { LMDBKVStore } from "../lmdb";
import {
  HasuraSdkSyncAdapter,
  HasuraSupportedNetwork,
} from "@nocturne-xyz/hasura-sync-adapters";

export const run = new Command("run")
  .summary("run test actor")
  .description(
    "must supply .env file with RPC_URL, BUNDLER_URL, SUBGRAPH_URL, HASURA_URL, TX_SIGNER_KEY, and NOCTURNE_SPENDING_KEY."
  )
  .requiredOption(
    "--config-name-or-path <string>",
    "config name or path to Nocturne contract JSON config file"
  )
  .requiredOption(
    "--wasm-path <string>",
    "path to joinsplit witness generation wasm"
  )
  .requiredOption("--zkey-path <string>", "path to joinsplit zkey")
  .requiredOption("--vkey-path <string>", "path to joinsplit vkey")
  .option("--db-path <string>", "path to lmdb database")
  .option(
    "--deposit-interval <number>",
    "interval in seconds between deposits in seconds. defaults to 60 (1 minute)",
    "60"
  )
  .option(
    "--op-interval <number>",
    "interval in seconds between ops in seconds. defaults to 60 (1 minute)",
    "60"
  )
  .option(
    "--full-bundle-every <number>",
    "perform 8 ops in rapid succession to fill a bundle every N iterations of the op loop"
  )
  .option(
    "--finality-blocks <number>",
    'number of confirmations to wait before considering new notes as "finalized"',
    parseInt
  )
  .option("--only-deposits", "only perform deposits")
  .option("--only-operations", "only perform operations")
  .option(
    "--log-dir <string>",
    "directory to write logs to. if not given, logs will only be emitted to stdout."
  )
  .option("--log-level <string>", "min log importance to log to stdout.")
  .action(async (options) => {
    const {
      configNameOrPath,
      wasmPath,
      zkeyPath,
      vkeyPath,
      dbPath,
      depositInterval,
      opInterval,
      fullBundleEvery,
      onlyDeposits,
      onlyOperations,
      logDir,
      logLevel,
      finalityBlocks,
    } = options;

    const configName = extractConfigName(configNameOrPath);
    const logger = makeLogger(
      configName,
      "test-actor",
      "actor",
      logLevel,
      logDir
    );

    const config = loadNocturneConfig(configNameOrPath);

    logger.info("config", { config });

    const bundlerEndpoint = process.env.BUNDLER_URL;
    if (!bundlerEndpoint) {
      throw new Error("missing BUNDLER_URL");
    }

    // TODO: enable switching on adapter impl
    const subgraphEndpoint = process.env.SUBGRAPH_URL;
    if (!subgraphEndpoint) {
      throw new Error("missing SUBGRAPH_URL");
    }

    const hasuraEndpoint = process.env.HASURA_URL;
    if (!hasuraEndpoint) {
      throw new Error("missing HASURA_URL");
    }

    // hex string
    const nocturneSKStr = process.env.NOCTURNE_SPENDING_KEY;
    if (!nocturneSKStr) {
      throw new Error("missing NOCTURNE_SPENDING_KEY");
    }
    const skBytes = ethers.utils.arrayify(nocturneSKStr);
    if (skBytes.length !== 32) {
      throw new Error("NOCTURNE_SPENDING_KEY must be 32 bytes");
    }

    const { signer, provider } =
      getEthersProviderAndSignerFromEnvConfiguration();

    const teller = Teller__factory.connect(config.tellerAddress, signer);
    const depositManager = DepositManager__factory.connect(
      config.depositManagerAddress,
      signer
    );

    const nocturneSigner = new NocturneSigner(skBytes);
    const kv = new LMDBKVStore({ path: dbPath });
    const merkleProver = await SparseMerkleProver.loadFromKV(kv);
    const db = new NocturneDB(kv);
    const syncAdapter = new HasuraSdkSyncAdapter(
      hasuraEndpoint,
      subgraphEndpoint,
      config.networkName as HasuraSupportedNetwork
    );
    const sdk = new NocturneClient(
      nocturneSigner.viewer(),
      provider,
      config,
      merkleProver,
      db,
      syncAdapter,
      new MockEthToTokenConverter(),
      new BundlerOpTracker(bundlerEndpoint)
    );

    const vkeyStr = fs.readFileSync(vkeyPath).toString();
    const vkey = JSON.parse(vkeyStr);
    const prover = new WasmJoinSplitProver(wasmPath, zkeyPath, vkey);

    const testTokens = new Map(
      Array.from(config.erc20s.entries()).filter(([key]) =>
        key.toLowerCase().includes("test")
      )
    );

    const actor = new TestActor(
      provider,
      signer,
      teller,
      depositManager,
      nocturneSigner,
      sdk,
      prover,
      bundlerEndpoint,
      testTokens,
      logger
    );

    if (onlyDeposits && onlyOperations) {
      throw new Error("cannot specify both only-deposits and only-operations");
    }

    await actor.run({
      depositIntervalSeconds: parseInt(depositInterval),
      opIntervalSeconds: parseInt(opInterval),
      fullBundleEvery: fullBundleEvery ? parseInt(fullBundleEvery) : undefined,
      onlyDeposits,
      onlyOperations,
      finalityBlocks: finalityBlocks ?? config.offchain.finalityBlocks,
    });
  });
