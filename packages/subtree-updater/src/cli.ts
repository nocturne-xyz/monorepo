import { program } from "commander";
import { SubtreeUpdateServer } from "./server";
import { RapidsnarkSubtreeUpdateProver } from "./rapidsnarkProver";
import { ethers } from "ethers";
import * as dotenv from "dotenv";

export default async function main(): Promise<void> {
  dotenv.config();

  program
    .requiredOption(
      "--walletContractAddr <string>",
      "address of the wallet contract"
    )
    .requiredOption(
      "--zkey <string>",
      "path to the subtree update circuit's proving key"
    )
    .requiredOption(
      "--vkey <string>",
      "path to the subtree update circuit's verifying key"
    )
    .requiredOption(
      "--prover <string>",
      "path to the rapidsnark prover executable"
    )
    .requiredOption(
      "--witnessGenerator <string>",
      "path to the subtree update circuit's witness generator executable"
    )
    .option(
      "--tmpDir <string>",
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
    zkey,
    vkey,
    prover,
    witnessGenreator,
    tmpDir,
    network,
    walletContractAddr,
    dbPath,
  } = program.opts();

  const submitterSecretKey = process.env.SUBMITTER_SECRET_KEY;
  if (submitterSecretKey === undefined) {
    throw new Error("SUBMITTER_SECRET_KEY env var not set");
  }

  const provider = ethers.getDefaultProvider(network);
  const signer = new ethers.Wallet(submitterSecretKey, provider);

  const rapidsnarkProver = new RapidsnarkSubtreeUpdateProver(
    prover,
    witnessGenreator,
    zkey,
    vkey,
    tmpDir
  );
  const server = new SubtreeUpdateServer(
    rapidsnarkProver,
    walletContractAddr,
    dbPath,
    signer
  );

  await server.start();
}

(async () => {
  await main();
})();
