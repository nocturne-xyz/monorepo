import { ethers } from "ethers";
import { open } from 'lmdb';
import { SubtreeUpdater } from "./src";
import { Wallet__factory } from "@nocturne-xyz/contracts";
import { RapidsnarkSubtreeUpdateProver } from './src/rapidsnarkProver';
import { program } from "commander";
import * as dotenv from 'dotenv';
import { clearTimeout } from "timers";

dotenv.config();

const TEN_SECONDS = 10 * 1000;

export class SubtreeUpdateServer {
  private updater: SubtreeUpdater;
  private interval: number;
  private timer?: NodeJS.Timeout;

  constructor(zkeyPath: string, vkeyPath: string, rapidsnarkExecutablePath: string, witnessGeneratorExecutablePath: string, rapidsnarkTmpDir: string, ) {
    const prover = new RapidsnarkSubtreeUpdateProver(rapidsnarkExecutablePath, witnessGeneratorExecutablePath, zkeyPath, vkeyPath, rapidsnarkTmpDir);

    // server params
    const walletContractAddress = process.env.WALLET_CONTRACT_ADDRESS;
    if (walletContractAddress === undefined) {
      throw new Error("WALLET_CONTRACT_ADDRESS env var not set");
    }

    const serverSecretKey = process.env.SERVER_SECRET_KEY;
    if (serverSecretKey === undefined) {
      throw new Error("SERVER_SECRET_KEY env var not set");
    }

    const network = process.env.NETWORK ?? "https://localhost:8545";

    const dbPath = process.env.DB_PATH ?? "./db";
    const provider = ethers.getDefaultProvider(network);
    const signer = new ethers.Wallet(serverSecretKey, provider);

    const walletContract = Wallet__factory.connect(walletContractAddress, signer);
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

program
  .requiredOption("--zkey <string>", "path to the subtree update circuit's proving key")
  .requiredOption("--vkey <string>", "path to the subtree update circuit's verifying key")
  .requiredOption("--prover <string>", "path to the rapidsnark prover executable")
  .requiredOption("--witnessGenerator <string>", "path to the subtree update circuit's witness generator executable")
  .option("--tmpDir <string>", "path to a dirctory to use for rapidsnark intermediate files", "./prover-tmp");

program.parse();

const { zkey, vkey, prover, witnessGenreator, tmpDir } = program.opts();

const server = new SubtreeUpdateServer(zkey, vkey, prover, witnessGenreator, tmpDir);
server.start();
