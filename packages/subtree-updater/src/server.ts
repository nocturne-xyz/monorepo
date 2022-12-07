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
  private stopped: boolean;
  private prom?: Promise<void>;
  private timer?: NodeJS.Timeout;

  constructor(prover: SubtreeUpdateProver, walletContractAddress: string, dbPath: string, signer: ethers.Signer, interval: number = TWELVE_SECONDS) {
    const walletContract = Wallet__factory.connect(walletContractAddress, signer);
    const rootDB = open({ path: dbPath });

    this.interval = interval;
    this.updater = new SubtreeUpdater(walletContract, rootDB, prover);
    this.stopped = true;
  }

  public async init(): Promise<void> {
    await this.updater.init();
  }

  public async start(): Promise<void> {
    this.stopped = false;
    const prom = new Promise<void>((resolve, reject) => {
      this.timer = setInterval(async () => {
        if (this.stopped) {
          resolve(undefined);
          return;
        }
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

    this.prom = prom.finally(() => clearTimeout(this.timer));
  } 

  public async stop(): Promise<void> {
    this.stopped = true;
    await this.prom;
    clearTimeout(this.timer);
  }

  public async dropDB(): Promise<void> {
    await this.updater.dropDB();
  }
}
