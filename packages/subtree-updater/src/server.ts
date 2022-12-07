import { ethers } from "ethers";
import { open } from 'lmdb';
import { SubtreeUpdater } from ".";
import { Wallet__factory } from "@nocturne-xyz/contracts";
import * as dotenv from 'dotenv';
import { clearTimeout } from "timers";
import { SubtreeUpdateProver } from "@nocturne-xyz/sdk";

dotenv.config();

const TWELVE_SECONDS = 12 * 1000;

export class SubtreeUpdateServer {
  private updater: SubtreeUpdater;
  private interval: number;
  private timer?: NodeJS.Timeout;

  constructor(prover: SubtreeUpdateProver, walletContractAddress: string, dbPath: string, signer: ethers.Signer, interval: number = TWELVE_SECONDS) {
    const walletContract = Wallet__factory.connect(walletContractAddress, signer);
    const rootDB = open({ path: dbPath });

    this.interval = interval;
    this.updater = new SubtreeUpdater(walletContract, rootDB, prover);
  }

  public async init(): Promise<void> {
    await this.updater.init();
  }

  public async start(): Promise<never> {
    const prom = new Promise<never>((resolve, reject) => {
      this.timer = setInterval(async () => {
        try {
          const batchFilled = await this.updater.pollInsertions();
          if (!batchFilled) {
            await this.updater.fillBatch();
          }
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

  public stop(): void {
    clearTimeout(this.timer);
  }

  public async dropDB(): Promise<void> {
    await this.updater.dropDB();
  }
}
