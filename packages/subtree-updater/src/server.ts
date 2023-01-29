import { ethers } from "ethers";
import { open } from "lmdb";
import { SubtreeUpdater } from ".";
import { Wallet__factory } from "@nocturne-xyz/contracts";
import { clearTimeout } from "timers";
import { SubtreeUpdateProver } from "@nocturne-xyz/sdk";
import { SyncSubtreeSubmitter } from "./submitter";

const TWELVE_SECONDS = 12 * 1000;

export interface SubtreeUpdaterServerOpts {
  indexingStartBlock?: number;
  interval?: number;
}

export class SubtreeUpdateServer {
  private updater: SubtreeUpdater;
  private interval: number;
  private stopped: boolean;
  private prom?: Promise<void>;
  private timer?: NodeJS.Timeout;
  private fillBatches: boolean;

  constructor(
    prover: SubtreeUpdateProver,
    walletContractAddress: string,
    dbPath: string,
    signer: ethers.Signer,
    opts?: SubtreeUpdaterServerOpts
  ) {
    const walletContract = Wallet__factory.connect(
      walletContractAddress,
      signer
    );
    const rootDB = open({ path: dbPath });

    const submitter = new SyncSubtreeSubmitter(walletContract);

    this.interval = opts?.interval ?? TWELVE_SECONDS;
    this.updater = new SubtreeUpdater(
      walletContract,
      rootDB,
      prover,
      submitter,
      opts?.indexingStartBlock
    );
    this.stopped = true;
  }

  public async init(): Promise<void> {
    await this.updater.init();
  }

  public async start(): Promise<void> {
    this.stopped = false;
    const prom = new Promise<void>((resolve, reject) => {
      const poll = async () => {
        if (this.stopped) {
          resolve(undefined);
          return;
        }

        try {
          console.log("polling for batch...");
          const filledBatch =
            await this.updater.pollInsertionsAndTryMakeBatch();

          if (filledBatch) {
            console.log("filled batch!");
            console.log("generating and submitting proof...");
            await this.updater.tryGenAndSubmitProofs();
            console.log("proof submitted!");
          } else if (this.fillBatches && this.updater.batchNotEmptyOrFull()) {
            console.log("batch not yet full. filling it with zeros...");
            await this.updater.fillBatch();
            await poll();
          }
        } catch (err) {
          console.error("subtree update server received an error:", err);
          reject(err);
        }
      };
      this.timer = setInterval(poll, this.interval);
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
