import IORedis from "ioredis";
import { Job } from "./types";
import { jobDataToJob } from "./utils";
import * as JSON from "bigint-json-serialization";

export class PersistentJobQueue<T> {
  readonly QUEUE_NAME: string;
  readonly redis: IORedis;

  constructor(queueName: string, redis: IORedis) {
    this.QUEUE_NAME = queueName;
    this.redis = redis;
  }

  async addSingle(jobData: T): Promise<string> {
    const job = jobDataToJob(jobData);
    await this.redis.rpush(this.QUEUE_NAME, JSON.stringify(job));

    return job.id;
  }

  async addMultiple(jobDatas: T[]): Promise<string[]> {
    const jobs = jobDatas.map(jobDataToJob);
    await this.redis.rpush(this.QUEUE_NAME, ...jobs.map(JSON.stringify));
    return jobs.map((job) => {
      return job.id;
    });
  }

  async getAddMultipleTransactions(jobDatas: T[]): Promise<string[][]> {
    const stringifiedJobs = jobDatas.map(jobDataToJob).map(JSON.stringify);
    return stringifiedJobs.map((job) => {
      return ["rpush", this.QUEUE_NAME, job];
    });
  }

  async pop(count: number): Promise<Job<T>[]> {
    let stringifiedJobs = await this.redis.lpop(this.QUEUE_NAME, count);
    if (!stringifiedJobs) {
      return [];
    }

    // TODO: bug in ioredis?
    if (!Array.isArray(stringifiedJobs)) {
      stringifiedJobs = [stringifiedJobs];
    }

    const jobs: Job<T>[] = stringifiedJobs.map(JSON.parse);
    return jobs;
  }

  async peek(count: number): Promise<Job<T>[]> {
    const stringifiedJobs = await this.redis.lrange(this.QUEUE_NAME, 0, count);
    if (!stringifiedJobs) {
      return [];
    }

    const jobs: Job<T>[] = stringifiedJobs.map(JSON.parse);
    return jobs;
  }

  async length(): Promise<number> {
    return this.redis.llen(this.QUEUE_NAME);
  }
}
