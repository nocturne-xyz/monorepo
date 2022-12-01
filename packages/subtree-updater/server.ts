import { ethers } from "ethers";
import { open } from 'lmdb';
import { subtreeUpdater } from "./src";
import { Wallet__factory } from "@nocturne-xyz/contracts";
import { getRapidsnarkSubtreeUpdateProver } from './src/rapidsnarkProver';
import findWorkspaceRoot from "find-yarn-workspace-root";
import * as path from "path";
import * as dotenv from 'dotenv';

dotenv.config();

const TEN_SECONDS = 10 * 1000;

// prover params
const ROOT_DIR = findWorkspaceRoot()!;
const ARTIFACTS_DIR = path.join(ROOT_DIR, "circuit-artifacts");
const WITNESS_GEN_EXECUTABLE_PATH = `${ARTIFACTS_DIR}/subtreeupdate/subtreeupdate_cpp/subtreeupdate`;
const ZKEY_PATH = `${ARTIFACTS_DIR}/subtreeupdate/subtreeupdate_cpp/subtreeupdate.zkey`;
const EXECUTABLE_CMD = "~/rapidsnark/build/prover";
const TMP_PATH = `${ARTIFACTS_DIR}/subtreeupdate/subtreeupdate_cpp`;

const prover = getRapidsnarkSubtreeUpdateProver(EXECUTABLE_CMD, WITNESS_GEN_EXECUTABLE_PATH, ZKEY_PATH, TMP_PATH);

// server params
const WALLET_CONTRACT_ADDRESS = process.env.WALLET_CONTRACT_ADDRESS;
if (WALLET_CONTRACT_ADDRESS === undefined) {
  throw new Error("WALLET_CONTRACT_ADDRESS env var not set");
}

const SERVER_SECRET_KEY = process.env.SERVER_SECRET_KEY;
if (SERVER_SECRET_KEY === undefined) {
  throw new Error("SERVER_SECRET_KEY env var not set");
}

const NETWORK = process.env.NETWORK ?? "https://localhost:8545";

const dbPath = process.env.DB_PATH ?? "./db";
const provider = ethers.getDefaultProvider(NETWORK);
const signer = new ethers.Wallet(SERVER_SECRET_KEY, provider);

const walletContract = Wallet__factory.connect(WALLET_CONTRACT_ADDRESS, signer);
const rootDB = open({ path: dbPath });
const interval= process.env.INTERVAL ? parseInt(process.env.INTERVAL) : TEN_SECONDS;

async function main() {
  const params = { walletContract, rootDB };
  const updater = await subtreeUpdater(params, prover);
  
  setTimeout(async () => {
    await updater.fillbatch();
    await updater.poll();
  }, interval);
}

main();
