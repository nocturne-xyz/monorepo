import { program } from "commander";
import { SubtreeUpdateServer } from "./src/server";
import { RapidsnarkSubtreeUpdateProver } from './src/rapidsnarkProver';
import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

program
  .requiredOption("--walletContractAddr <string>", "address of the wallet contract")
  .requiredOption("--zkey <string>", "path to the subtree update circuit's proving key")
  .requiredOption("--vkey <string>", "path to the subtree update circuit's verifying key")
  .requiredOption("--prover <string>", "path to the rapidsnark prover executable")
  .requiredOption("--witnessGenerator <string>", "path to the subtree update circuit's witness generator executable")
  .option("--tmpDir <string>", "path to a dirctory to use for rapidsnark intermediate files", "./prover-tmp")
  .option("--network <string>", "network to connect to", "https://localhost:8545")
  .option("--dbPath <string>", "path to the store DB files", "./db");

program.parse();

const { zkey, vkey, prover, witnessGenreator, tmpDir, network, walletContractAddr, dbPath } = program.opts();

const serverSecretKey = process.env.SERVER_SECRET_KEY;
if (serverSecretKey === undefined) {
  throw new Error("SERVER_SECRET_KEY env var not set");
}

const provider = ethers.getDefaultProvider(network);
const signer = new ethers.Wallet(serverSecretKey, provider);

const rapidsnarkProver = new RapidsnarkSubtreeUpdateProver(prover, witnessGenreator, zkey, vkey, tmpDir);
const server = new SubtreeUpdateServer(rapidsnarkProver, walletContractAddr, dbPath, signer);
server.start();
