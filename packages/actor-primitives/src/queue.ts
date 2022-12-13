import IORedis from "ioredis";
import { Job, jobFromJson } from "./types";
import { jobDataToJob, toJSON } from "./utils";

export class PersistentQueue<T> {
  readonly QUEUE_NAME: string;
  readonly redis: IORedis;
  readonly deserializeT: (json: string | any) => T;

  constructor(queueName: string, deserFn: (json: string | any) => T) {
    this.QUEUE_NAME = queueName;
    const redisUrl = process.env.REDIS_URL ?? "localhost:6379";
    this.redis = new IORedis(redisUrl);
    this.deserializeT = deserFn;
  }

  async addSingle(jobData: T): Promise<string> {
    const job = jobDataToJob(jobData);
    await this.redis.lpush(this.QUEUE_NAME, toJSON(job));

    return job.id;
  }

  async addMultiple(jobDatas: T[]): Promise<string[]> {
    const jobs = jobDatas.map(jobDataToJob);
    await this.redis.lpush(this.QUEUE_NAME, ...jobs.map(toJSON));
    return jobs.map((job) => {
      return job.id;
    });
  }

  //   async getAddMultipleTransaction(jobDatas: T[]): Promise<string[][]> {
  //     const jobs = jobDatas.map(jobDataToJob);
  //   }

  async peek(): Promise<Job<T>> {
    const lastIndex = (await this.length()) - 1;
    const stringifiedJob = await this.redis.lindex(this.QUEUE_NAME, lastIndex);
    return jobFromJson(this.deserializeT, stringifiedJob);
  }

  async length(): Promise<number> {
    return this.redis.llen(this.QUEUE_NAME);
  }
}
