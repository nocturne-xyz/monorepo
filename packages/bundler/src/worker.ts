import { Wallet, Wallet__factory } from "@nocturne-xyz/contracts";
import { Address, Bundle, provenOperationFromJSON } from "@nocturne-xyz/sdk";
import { Job, Worker } from "bullmq";
import IORedis from "ioredis";
import { providers, Wallet as EthersWallet } from "ethers";
import {
  OperationStatus,
  PROVEN_OPERATIONS_QUEUE,
  RelayJobData,
} from "./common";
import { updateOperationStatus } from "./utils";

export class BundlerWorker {
  readonly batchSize: number = 8;
  readonly intervalSeconds: number = 60;

  token: string;
  worker: Worker;
  wallet: Wallet; // TODO: replace with tx manager
  currentBatch: Job<RelayJobData>[]; // keep job handles to set failed/completed

  constructor(workerName: string, walletAddress: Address) {
    this.token = workerName;
    const redisUrl = process.env.REDIS_URL ?? "redis://redis:6379";
    const connection = new IORedis(redisUrl);
    this.worker = new Worker(PROVEN_OPERATIONS_QUEUE, undefined, {
      connection,
      autorun: false,
    }); // TODO: pass in undefined processor function?

    const privateKey = process.env.TX_SIGNER_KEY!;
    if (!privateKey) {
      throw new Error("Missing TX_SIGNER_KEY");
    }

    const rpcUrl = process.env.RPC_URL!;
    if (!rpcUrl) {
      throw new Error("Missing RPC_URL");
    }

    const provider = new providers.JsonRpcProvider(rpcUrl);
    const signingProvider = new EthersWallet(privateKey, provider);
    this.wallet = Wallet__factory.connect(walletAddress, signingProvider);

    this.currentBatch = [];
  }

  async run() {
    // Wanted to have worker be single threaded, no interrupts so using
    // rough est counter for 60 sec timer
    let counterSeconds = 0;
    while (true) {
      if (this.currentBatch.length == this.batchSize) {
        await this.submitBatch();
      } else if (
        counterSeconds == this.intervalSeconds &&
        this.currentBatch.length > 0
      ) {
        await this.submitBatch();
      } else {
        await this.pullJobsFromQueue();
      }

      // await sleep(950); // sleep ~1 sec, increment counter (approx)
      counterSeconds += 1;
    }
  }

  private async pullJobsFromQueue(): Promise<void> {
    let job = (await this.worker.getNextJob(this.token)) as Job<RelayJobData>;
    while (job && this.currentBatch.length < this.batchSize) {
      // NOTE: Job status (not op status) is ACTIVE once pulled off here
      await updateOperationStatus(job, OperationStatus.ACCEPTED);
      this.currentBatch.push(job);
      job = (await this.worker.getNextJob(this.token)) as Job<RelayJobData>;
    }
  }

  async submitBatch(): Promise<void> {
    // TODO: Format batch proofs and PIs?
    const bundle: Bundle = {
      operations: this.currentBatch.map((job) => {
        return provenOperationFromJSON(job.data.operationJson);
      }),
    };

    // Loop through current batch and set each job status to IN_FLIGHT
    this.currentBatch.forEach((job) => {
      updateOperationStatus(job, OperationStatus.IN_FLIGHT);
    });

    await this.wallet.processBundle(bundle);

    // TODO: index for OperationProcessed event
    // TODO: Loop through array of results and statuses and set jobs statuses
    // appropriately based on results
  }
}
