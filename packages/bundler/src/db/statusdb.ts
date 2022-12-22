import IORedis from "ioredis";
import { OperationStatus } from "../common";

const JOB_STATUS_PREFIX = "JOB_STATUS_";

export class StatusDB {
  redis: IORedis;

  constructor(redis: IORedis) {
    this.redis = redis;
  }

  private static jobStatusKey(id: string): string {
    return JOB_STATUS_PREFIX + id;
  }

  async setJobStatus(id: string, status: OperationStatus): Promise<void> {
    await this.redis.set(StatusDB.jobStatusKey(id), status.toString());
  }

  async getJobStatus(id: string): Promise<OperationStatus | undefined> {
    const statusString = await this.redis.get(JOB_STATUS_PREFIX + id);

    if (!statusString) {
      return undefined;
    }

    return OperationStatus[statusString as keyof typeof OperationStatus];
  }

  getSetJobStatusTransaction(id: string, status: OperationStatus): string[] {
    const key = StatusDB.jobStatusKey(id);
    return ["set", key, status.toString()];
  }
}
