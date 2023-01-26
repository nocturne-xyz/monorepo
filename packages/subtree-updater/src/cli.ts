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
      "--wallet-address <string>",
      "address of the wallet contract"
    )
    .requiredOption(
      "--zkey-path <stirng>",
      "path to `subtreeupdate.zkey`, i.e. the proving key for the subtree update circuit"
    )
    .requiredOption(
      "--vkey-path <string>",
      "path to `vkey.json`, the verification key for the subtree update circuit"
    )
    .option(
      "--use-mock-prover",
      "use a mock prover instead of rapidsnark. This is useful for testing"
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
      "--network <string>",
      "network to connect to",
      "https://localhost:8545"
    )
    .option("--dbPath <string>", "path to the store DB files", "./db");

  program.parse();

  const {
    tmpDir,
    network,
    dbPath,
    zkeyPath,
    vkeyPath,
    proverPath,
    witnessGeneratorPath,
    walletAddress,
    useMockProver,
  } = program.opts();

  const submitterSecretKey = process.env.SUBMITTER_SECRET_KEY;
  if (submitterSecretKey === undefined) {
    throw new Error("SUBMITTER_SECRET_KEY env var not set");
  }

  const provider = ethers.getDefaultProvider(network);
  const signer = new ethers.Wallet(submitterSecretKey, provider);

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

  const server = new SubtreeUpdateServer(prover, walletAddress, dbPath, signer);

  await server.start();
}

(async () => {
  await main();
})();
