#! /usr/bin/env node

import { loadNocturneConfig } from "@nocturne-xyz/config";
import {
  DepositManager__factory,
  Wallet__factory,
} from "@nocturne-xyz/contracts";
import {
  DepositRequest,
  InMemoryKVStore,
  InMemoryMerkleProver,
  NocturneDB,
  NocturneSigner,
  NocturneWalletSDK,
  OperationRequest,
  SubgraphSDKSyncAdapter,
} from "@nocturne-xyz/sdk";
import { Command } from "commander";
import { ethers } from "ethers";
import { TestActor } from "../actor";
import { NocturneFrontendSDK } from "@nocturne-xyz/frontend-sdk";
import { program } from "commander";
import * as fs from "fs";
import * as BigintJSON from "bigint-json-serialization";
import * as dotenv from "dotenv";

const run = new Command("run")
  .summary("run test actor")
  .description(
    "Must supply .env file with RPC_URL, BUNDLER_URL, SUBGRPH_URL, TX_SIGNER_KEY, and NOCTURNE_SK."
  )
  .requiredOption(
    "--nocturne-config-path <string>",
    "path to serialized NocturneConfig"
  )
  .requiredOption(
    "--wasm-path <string>",
    "path to joinsplit witness generation wasm"
  )
  .requiredOption("--zkey-path <string>", "path to joinsplit zkey")
  .requiredOption("--vkey-path <string>", "path to joinsplit vkey")
  .option(
    "--op-requests-path <string>",
    "path to a JSON file containing the set of op requests the actor will perform"
  )
  .option(
    "--deposit-requests-path <string>",
    "path to a JSON file containing the set of deposit requests the actor will perform"
  )
  .action(async (options) => {
    const {
      nocturneConfigPath,
      wasmPath,
      zkeyPath,
      vkeyPath,
      opRequestsPath,
      depositRequestsPath,
    } = options;

    const config = loadNocturneConfig(nocturneConfigPath);

    const rpcUrl = process.env.RPC_URL;
    if (!rpcUrl) {
      throw new Error("Missing RPC_URL");
    }

    const bundlerEndpoint = process.env.BUNDLER_URL;
    if (!bundlerEndpoint) {
      throw new Error("Missing BUNDLER_URL");
    }

    // TODO: enable switching on adapter impl
    const subgraphEndpoint = process.env.SUBGRAPH_URL;
    if (!subgraphEndpoint) {
      throw new Error("Missing SUBGRAPH_URL");
    }

    const privateKey = process.env.TX_SIGNER_KEY;
    if (!privateKey) {
      throw new Error("Missing TX_SIGNER_KEY");
    }

    const nocturneSKStr = process.env.NOCTURNE_SIGNING_KEY;
    if (!nocturneSKStr) {
      throw new Error("Missing NOCTURNE_SK");
    }
    const nocturneSK = BigInt(nocturneSKStr);

    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    const signingProvider = new ethers.Wallet(privateKey, provider);

    const wallet = Wallet__factory.connect(
      config.walletAddress(),
      signingProvider
    );
    const depositManager = DepositManager__factory.connect(
      config.depositManagerAddress(),
      signingProvider
    );

    const nocturneSigner = new NocturneSigner(nocturneSK);
    const merkleProver = new InMemoryMerkleProver();
    const kv = new InMemoryKVStore();
    const db = new NocturneDB(kv);
    const syncAdapter = new SubgraphSDKSyncAdapter(subgraphEndpoint);
    const sdk = new NocturneWalletSDK(
      nocturneSigner,
      provider,
      config,
      merkleProver,
      db,
      syncAdapter
    );

    const vkey = JSON.parse(vkeyPath);
    const frontendSDK = new NocturneFrontendSDK(
      bundlerEndpoint,
      wallet,
      config.vaultAddress(),
      wasmPath,
      zkeyPath,
      vkey
    );

    let depositRequests: DepositRequest[] = [];
    if (depositRequestsPath) {
      const depositRequestsStr = fs
        .readFileSync(depositRequestsPath)
        .toString();
      depositRequests = BigintJSON.parse(
        depositRequestsStr
      ) as DepositRequest[];
    }

    let opRequests: OperationRequest[] = [];
    if (opRequestsPath) {
      const opRequestsStr = fs.readFileSync(opRequestsPath).toString();
      opRequests = BigintJSON.parse(opRequestsStr) as OperationRequest[];
    }

    const actor = new TestActor(
      wallet,
      depositManager,
      sdk,
      frontendSDK,
      depositRequests,
      opRequests
    );

    await actor.run();
  });

export default async function main(): Promise<void> {
  dotenv.config();

  program
    .name("test-actor-cli")
    .description("CLI for running nocturne test actor")
    .addCommand(run);
  await program.parseAsync(process.argv);
}

main().catch((e) => console.log(`test actor exited with error: ${e}`));
