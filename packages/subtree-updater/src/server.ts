import { ethers } from "ethers";
import { open } from "lmdb";
import { SubtreeUpdater } from ".";
import { Handler__factory } from "@nocturne-xyz/contracts";
import { clearTimeout } from "timers";
import { SubtreeUpdateProver } from "@nocturne-xyz/sdk";
import { SyncSubtreeSubmitter } from "./submitter";
import { Logger } from "winston";

const TWELVE_SECONDS = 12 * 1000;

export interface SubtreeUpdaterServerOpts {
  indexingStartBlock?: number;
  interval?: number;
  fillBatches?: boolean;
}

export class SubtreeUpdateServer {
  private updater: SubtreeUpdater;
  private interval: number;
  private stopped: boolean;
  private prom?: Promise<void>;
  private timer?: NodeJS.Timeout;
  private fillBatches: boolean;
  private logger: Logger;

  constructor(
    prover: SubtreeUpdateProver,
    handlerContractAddress: string,
    dbPath: string,
    signer: ethers.Signer,
    logger: Logger,
    opts?: SubtreeUpdaterServerOpts
  ) {
    const handlerContract = Handler__factory.connect(
      handlerContractAddress,
      signer
    );
    const rootDB = open({ path: dbPath });

    const submitter = new SyncSubtreeSubmitter(handlerContract);

    this.interval = opts?.interval ?? TWELVE_SECONDS;
    this.fillBatches = opts?.fillBatches ?? false;
    this.updater = new SubtreeUpdater(
      handlerContract,
      rootDB,
      prover,
      submitter,
      opts?.indexingStartBlock
    );
    this.logger = logger;
    this.stopped = true;
  }

  public async init(): Promise<void> {
    await this.updater.init(this.logger.child({ function: "init" }));
  }

  public start(): void {
    this.logger.info("starting subtree update server...");
    this.logger.info(`polling from block ${this.updater.indexingStartBlock}`);

    this.stopped = false;
    const prom = new Promise<void>((resolve, reject) => {
      const poll = async () => {
        if (this.stopped) {
          resolve(undefined);
          return;
        }
        try {
          this.logger.debug("polling for batch...");
          const filledBatch = await this.updater.pollInsertionsAndTryMakeBatch(
            this.logger.child({
              function: "pollInsertionsAndTryMakeBatch",
            })
          );

          if (filledBatch) {
            this.logger.debug("filled batch!");

            await this.updater.tryGenAndSubmitProofs(
              this.logger.child({
                function: "tryGenAndSubmitProofs",
              })
            );

            this.logger.debug("proof submitted!");
          } else if (this.fillBatches && this.updater.batchNotEmptyOrFull()) {
            this.logger.debug("batch not yet full. filling it with zeros...");
            await this.updater.fillBatch();
            await poll();
          }
        } catch (err) {
          this.logger.error("subtree update server received an error:", err);
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
