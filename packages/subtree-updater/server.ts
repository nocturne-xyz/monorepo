import { ethers } from "ethers";
import { open } from 'lmdb';
import { SubtreeUpdater } from "./src";
import { Wallet__factory } from "@nocturne-xyz/contracts";
import { RapidsnarkSubtreeUpdateProver } from './src/rapidsnarkProver';
import findWorkspaceRoot from "find-yarn-workspace-root";
import * as path from "path";
import * as dotenv from 'dotenv';
import { clearTimeout } from "timers";

dotenv.config();

const TEN_SECONDS = 10 * 1000;

export class SubtreeUpdateServer {
  private updater: SubtreeUpdater;
  private interval: number;
  private timer?: NodeJS.Timeout;

  constructor() {
    // prover params
    const ROOT_DIR = findWorkspaceRoot()!;
    const ARTIFACTS_DIR = path.join(ROOT_DIR, "circuit-artifacts");
    const WITNESS_GEN_EXECUTABLE_PATH = `${ARTIFACTS_DIR}/subtreeupdate/subtreeupdate_cpp/subtreeupdate`;
    const ZKEY_PATH = `${ARTIFACTS_DIR}/subtreeupdate/subtreeupdate_cpp/subtreeupdate.zkey`;
    const EXECUTABLE_CMD = "~/rapidsnark/build/prover";
    const TMP_DIR = `${ARTIFACTS_DIR}/subtreeupdate/subtreeupdate_cpp`;

    const prover = new RapidsnarkSubtreeUpdateProver(EXECUTABLE_CMD, WITNESS_GEN_EXECUTABLE_PATH, ZKEY_PATH, TMP_DIR);

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

    this.interval = process.env.INTERVAL ? parseInt(process.env.INTERVAL) : TEN_SECONDS;
    this.updater = new SubtreeUpdater(walletContract, rootDB, prover);
  }

  public async start(): Promise<never> {
    const prom = new Promise<never>((resolve, reject) => {
      this.timer = setInterval(() => {
        try {
          this.updater.poll();
        } catch (err) {
          console.error("subtree update server received an error:", err);
          reject(err);
        }
      }, this.interval);
    });

    return prom.finally(() => {
      clearTimeout(this.timer);
    });
  } 

}

const server = new SubtreeUpdateServer();
server.start();
