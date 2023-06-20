import { loadNocturneConfig } from "@nocturne-xyz/config";
import {
  DepositManager__factory,
  Teller__factory,
} from "@nocturne-xyz/contracts";
import {
  InMemoryKVStore,
  SparseMerkleProver,
  NocturneDB,
  NocturneSigner,
  NocturneWalletSDK,
  SubgraphSDKSyncAdapter,
  MockEthToTokenConverter,
  BundlerOpTracker,
} from "@nocturne-xyz/sdk";
import { WasmJoinSplitProver } from "@nocturne-xyz/local-prover";
import { Command } from "commander";
import { ethers } from "ethers";
import { TestActor } from "../actor";
import * as fs from "fs";
import { makeLogger } from "@nocturne-xyz/offchain-utils";

export const run = new Command("run")
  .summary("run test actor")
  .description(
    "must supply .env file with RPC_URL, BUNDLER_URL, SUBGRAPH_URL, TX_SIGNER_KEY, and NOCTURNE_SPENDING_KEY."
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
  .option("--interval <number>", "interval between deposits/ops in seconds")
  .option("--only-deposits", "only perform deposits")
  .option("--only-operations", "only perform operations")
  .option(
    "--log-dir <string>",
    "directory to write logs to",
    "./logs/deposit-screener-processor"
  )
  .option(
    "--stdout-log-level <string>",
    "min log importance to log to stdout. if not given, logs will not be emitted to stdout"
  )
  .action(async (options) => {
    const {
      configNameOrPath,
      wasmPath,
      zkeyPath,
      vkeyPath,
      interval,
      onlyDeposits,
      onlyOperations,
      logDir,
      stdoutLogLevel,
    } = options;

    const logger = makeLogger(logDir, "test-actor", "actor", stdoutLogLevel);

    const config = loadNocturneConfig(configNameOrPath);

    logger.info("config", { config });

    const rpcUrl = process.env.RPC_URL;
    if (!rpcUrl) {
      throw new Error("missing RPC_URL");
    }

    const bundlerEndpoint = process.env.BUNDLER_URL;
    if (!bundlerEndpoint) {
      throw new Error("missing BUNDLER_URL");
    }

    // TODO: enable switching on adapter impl
    const subgraphEndpoint = process.env.SUBGRAPH_URL;
    if (!subgraphEndpoint) {
      throw new Error("missing SUBGRAPH_URL");
    }

    const privateKey = process.env.TX_SIGNER_KEY;
    if (!privateKey) {
      throw new Error("missing TX_SIGNER_KEY");
    }

    const nocturneSKStr = process.env.NOCTURNE_SPENDING_KEY;
    if (!nocturneSKStr) {
      throw new Error("missing NOCTURNE_SPENDING_KEY");
    }
    const nocturneSK = BigInt(nocturneSKStr);

    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    const signingProvider = new ethers.Wallet(privateKey, provider);

    const teller = Teller__factory.connect(
      config.tellerAddress(),
      signingProvider
    );
    const depositManager = DepositManager__factory.connect(
      config.depositManagerAddress(),
      signingProvider
    );

    const nocturneSigner = new NocturneSigner(nocturneSK);
    const kv = new InMemoryKVStore();
    const merkleProver = new SparseMerkleProver(kv);
    const db = new NocturneDB(kv);
    const syncAdapter = new SubgraphSDKSyncAdapter(subgraphEndpoint);
    const sdk = new NocturneWalletSDK(
      nocturneSigner,
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
      signingProvider,
      teller,
      depositManager,
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
      intervalSeconds: interval,
      onlyDeposits,
      onlyOperations,
    });
  });
