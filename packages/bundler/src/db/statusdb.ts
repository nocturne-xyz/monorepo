import IORedis from "ioredis";
import { OperationStatus } from "../common";

const JOB_STATUS_PREFIX = "JOB_STATUS_";

export class StatusDB {
  redis: IORedis;

  constructor(redis: IORedis) {
    this.redis = redis;
  }

  async setJobStatus(id: string, status: OperationStatus): Promise<void> {
    await this.redis.set(JOB_STATUS_PREFIX + id, status);
  }

  async getJobStatus(id: string): Promise<OperationStatus | undefined> {
    const statusString = await this.redis.get(JOB_STATUS_PREFIX + id);

    if (!statusString) {
      return undefined;
    }

    return OperationStatus[statusString as keyof typeof OperationStatus];
  }
}
