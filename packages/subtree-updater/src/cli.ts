#! /usr/bin/env node

import { program } from "commander";
import { SubtreeUpdateServer } from "./server";
import { RapidsnarkSubtreeUpdateProver } from "./rapidsnarkProver";
import { ethers } from "ethers";
import * as dotenv from "dotenv";

export default async function main(): Promise<void> {
  dotenv.config();

  program
    .requiredOption(
      "--accountant-address <string>",
      "address of the accountant contract"
    )
    .requiredOption(
      "--zkey-path <stirng>",
      "path to `subtreeupdate.zkey`, i.e. the proving key for the subtree update circuit"
    )
    .requiredOption(
      "--vkey-path <string>",
      "path to `vkey.json`, the verification key for the subtree update circuit"
    )
    .requiredOption(
      "--prover-path <string>",
      "path to the rapidsnark prover exectuable. After building from the rapidsnark repo, this is typically `rapidsnark/build/prover`"
    )
    .requiredOption(
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
    accountantAddress,
  } = program.opts();

  const submitterSecretKey = process.env.SUBMITTER_SECRET_KEY;
  if (submitterSecretKey === undefined) {
    throw new Error("SUBMITTER_SECRET_KEY env var not set");
  }

  const provider = ethers.getDefaultProvider(network);
  const signer = new ethers.Wallet(submitterSecretKey, provider);

  const rapidsnarkProver = new RapidsnarkSubtreeUpdateProver(
    proverPath,
    witnessGeneratorPath,
    zkeyPath,
    vkeyPath,
    tmpDir
  );
  const server = new SubtreeUpdateServer(
    rapidsnarkProver,
    accountantAddress,
    dbPath,
    signer
  );

  await server.start();
}

(async () => {
  await main();
})();
