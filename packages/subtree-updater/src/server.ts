import { ethers } from "ethers";
import { open } from "lmdb";
import { SubtreeUpdater, SubtreeUpdaterOpts } from ".";
import { Wallet__factory } from "@nocturne-xyz/contracts";
import { clearTimeout } from "timers";
import { SubtreeUpdateProver } from "@nocturne-xyz/sdk";
import { SyncSubtreeSubmitter } from "./submitter";

export class SubtreeUpdateServer {
  private updater: SubtreeUpdater;
  private interval: number;
  private stopped: boolean;
  private prom?: Promise<void>;
  private timer?: NodeJS.Timeout;

  constructor(
    prover: SubtreeUpdateProver,
    walletContractAddress: string,
    dbPath: string,
    signer: ethers.Signer,
    interval: number,
    opts?: SubtreeUpdaterOpts
  ) {
    const walletContract = Wallet__factory.connect(
      walletContractAddress,
      signer
    );
    const rootDB = open({ path: dbPath });

    const submitter = new SyncSubtreeSubmitter(walletContract);

    this.interval = interval;
    this.updater = new SubtreeUpdater(
      walletContract,
      rootDB,
      prover,
      submitter,
      opts
    );
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
          console.log("polling for batch...");
          const filledBatch =
            await this.updater.pollInsertionsAndTryMakeBatch();

          if (filledBatch) {
            console.log("filled batch! generating and submitting proof");
            await this.updater.tryGenAndSubmitProofs();
            console.log("proof submitted");
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
