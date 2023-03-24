#! /usr/bin/env node

import { program } from "commander";
import { SubtreeUpdateServer } from "./server";
import { RapidsnarkSubtreeUpdateProver } from "./rapidsnarkProver";
import { ethers } from "ethers";
import * as dotenv from "dotenv";
import { MockSubtreeUpdateProver } from "@nocturne-xyz/sdk";

export default async function main(): Promise<void> {
  dotenv.config();

  program
    .requiredOption(
      "--handler-address <string>",
      "address of the handler contract"
    )
    .requiredOption(
      "--zkey-path <string>",
      "path to `subtreeupdate.zkey`, i.e. the proving key for the subtree update circuit"
    )
    .requiredOption(
      "--vkey-path <string>",
      "path to `vkey.json`, the verification key for the subtree update circuit"
    )
    .option(
      "--interval <number>",
      "polling interval for checking for state and attempting to submit proofs",
      parseInt
    )
    .option(
      "--use-mock-prover",
      "use a mock prover instead of rapidsnark. This is useful for testing"
    )
    .option(
      "--fill-batches",
      "every time updater polls, ensure the batch is full by filling it with zeros",
      false
    )
    .option(
      "--prover-path <string>",
      "path to the rapidsnark prover exectuable. After building from the rapidsnark repo, this is typically `rapidsnark/build/prover`"
    )
    .option(
      "--witness-generator-path <string>",
      "path to the C++ witness generator executable. This can be built by running `make` in the `subtreeupdate_cpp` directory emitted by circom"
    )
    .option(
      "--tmp-dir <string>",
      "path to a dirctory to use for rapidsnark intermediate files",
      "./prover-tmp"
    )
    .option(
      "--indexing-start-block <number>",
      "block to start indexing at",
      parseInt
    )
    .option("--dbPath <string>", "path to the store DB files", "./db");

  program.parse();

  const {
    tmpDir,
    dbPath,
    zkeyPath,
    vkeyPath,
    proverPath,
    witnessGeneratorPath,
    handlerAddress,
    useMockProver,
    interval,
    indexingStartBlock,
    fillBatches,
  } = program.opts();

  const rpcUrl = process.env.RPC_URL;
  if (!rpcUrl) {
    throw new Error("RPC_URL env var not set");
  }

  const submitterSecretKey = process.env.TX_SIGNER_KEY;
  if (!submitterSecretKey) {
    throw new Error("TX_SIGNER_KEY env var not set");
  }

  console.log("rpcUrl", rpcUrl);
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.handler(submitterSecretKey, provider);

  let prover;
  if (useMockProver) {
    prover = new MockSubtreeUpdateProver();
  } else {
    if (proverPath === undefined || witnessGeneratorPath === undefined) {
      throw new Error(
        "Must provide --prover-path and --witness-generator-path when not using mock prover"
      );
    }
    prover = new RapidsnarkSubtreeUpdateProver(
      proverPath,
      witnessGeneratorPath,
      zkeyPath,
      vkeyPath,
      tmpDir
    );
  }

  const server = new SubtreeUpdateServer(
    prover,
    handlerAddress,
    dbPath,
    signer,
    { indexingStartBlock, interval, fillBatches }
  );

  await server.start();
}

main().catch((e) => console.log(`Subtree updater exited with error: ${e}`));
