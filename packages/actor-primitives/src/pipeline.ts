import { PersistentJobQueue } from "./queue";
import IORedis from "ioredis";
import { getRedis } from "./utils";

export type TransformFunction<I, O> = (inputDatas: I[]) => O[];

export class SingleConsumerJobPipeline<I, O> {
  redis: IORedis;
  inputQueue: PersistentJobQueue<I>;
  outputQueue: PersistentJobQueue<O>;
  transformFn: TransformFunction<I, O>;
  batchSize = 8;

  constructor(
    inputQueueName: string,
    outputQueueName: string,
    transformFn: TransformFunction<I, O>,
    batchSize?: number,
    redis?: IORedis
  ) {
    this.redis = getRedis(redis);
    this.inputQueue = new PersistentJobQueue<I>(inputQueueName, redis);
    this.outputQueue = new PersistentJobQueue<O>(outputQueueName, redis);
    this.transformFn = transformFn;

    if (batchSize) {
      this.batchSize = batchSize;
    }
  }

  async processJobs(): Promise<void> {
    const inputJobs = await this.inputQueue.peek(this.batchSize);
    const inputDatas = inputJobs.map((job) => {
      return job.data;
    });
    const outputDatas = this.transformFn(inputDatas);

    const inputTx = this.inputQueue.getRemoveTransaction(this.batchSize);
    const outputTx = this.outputQueue.getAddMultipleTransaction(outputDatas);

    const bothTxs = inputTx.concat(outputTx);
    await this.redis.multi(bothTxs).exec((err) => {
      if (err) {
        throw Error("Transaction failed");
      }
    });
  }
}
