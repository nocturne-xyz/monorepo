import { Wallet, Wallet__factory } from "@nocturne-xyz/contracts";
import { OperationProcessedEvent } from "@nocturne-xyz/contracts/dist/src/Wallet";
import { Address, Bundle, ProvenOperation } from "@nocturne-xyz/sdk";
import { parseEventsFromContractReceipt } from "@nocturne-xyz/sdk/dist/src/sdk/utils/ethers";
import { Job, Worker } from "bullmq";
import IORedis from "ioredis";
import { providers, Wallet as EthersWallet } from "ethers";
import {
  OperationStatus,
  PROVEN_OPERATIONS_QUEUE,
  RelayJobData,
} from "./common";
import { getRedis, sleep } from "./utils";
import { StatusDB } from "./statusdb";

export class BundlerWorker {
  readonly batchSize: number = 8;
  readonly intervalSeconds: number = 60;

  token: string;
  worker: Worker;
  wallet: Wallet; // TODO: replace with tx manager
  currentBatch: Job<RelayJobData>[]; // keep job handles to set failed/completed
  statusDB: StatusDB;

  constructor(workerName: string, walletAddress: Address, redis?: IORedis) {
    this.token = workerName;

    const connection = getRedis(redis);
    this.worker = new Worker(PROVEN_OPERATIONS_QUEUE, undefined, {
      connection,
      autorun: false,
    }); // TODO: pass in undefined processor function?
    this.statusDB = new StatusDB(connection);

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
        this.currentBatch = [];
      } else if (
        counterSeconds == this.intervalSeconds &&
        this.currentBatch.length > 0
      ) {
        await this.submitBatch();
        this.currentBatch = [];
      } else {
        await this.pullJobsFromQueue();
      }

      await sleep(950); // sleep ~1 sec, increment counter (approx)
      counterSeconds += 1;
    }
  }

  private async pullJobsFromQueue(): Promise<void> {
    let job = (await this.worker.getNextJob(this.token)) as Job<RelayJobData>;
    while (job && this.currentBatch.length < this.batchSize) {
      // NOTE: Job status (not op status) is ACTIVE once pulled off here
      await this.statusDB.setJobStatus(job.id!, OperationStatus.ACCEPTED);
      this.currentBatch.push(job);
      job = (await this.worker.getNextJob(this.token)) as Job<RelayJobData>;
    }
  }

  async submitBatch(): Promise<void> {
    // TODO: Format batch proofs and PIs?
    const bundle: Bundle = {
      operations: this.currentBatch.map((job) => {
        return JSON.parse(job.data.operationJson) as ProvenOperation;
      }),
    };

    // Loop through current batch and set each job status to IN_FLIGHT
    this.currentBatch.forEach(async ({ id }) => {
      await this.statusDB.setJobStatus(id!, OperationStatus.IN_FLIGHT);
    });

    // Hardcode gas limit to skip eth_estimateGas
    const tx = await this.wallet.processBundle(bundle, { gasLimit: 1_000_000 });
    const receipt = await tx.wait();

    const matchingEvents = parseEventsFromContractReceipt(
      receipt,
      "OperationProcessed"
    ) as OperationProcessedEvent[];

    for (const { args } of matchingEvents) {
      const eventDigest = args.operationDigest.toBigInt();
      const status = args.opSuccess
        ? OperationStatus.EXECUTED_SUCCESS
        : OperationStatus.EXECUTED_FAILED;

      await this.statusDB.setJobStatus(eventDigest.toString(), status);
    }
  }
}
