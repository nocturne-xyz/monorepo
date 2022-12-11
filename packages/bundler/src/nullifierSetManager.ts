import { ProvenOperation } from "@nocturne-xyz/sdk";
import IORedis from "ioredis";

const NULLIFIER_PREFIX = "NULLIFIER_";

export class NullifierSetManager {
  redis: IORedis;

  constructor(redis: IORedis) {
    this.redis = redis;
  }

  private static nullifierKey(nullifier: bigint): string {
    return NULLIFIER_PREFIX + nullifier.toString();
  }

  async addNullifiers(
    operation: ProvenOperation,
    jobId: string
  ): Promise<void> {
    const addNfPromises = operation.joinSplitTxs.flatMap(
      ({ nullifierA, nullifierB }) => {
        return [
          this.addNullifier(nullifierA, jobId),
          this.addNullifier(nullifierB, jobId),
        ];
      }
    );

    await Promise.all(addNfPromises);
  }

  protected async addNullifier(
    nullifier: bigint,
    jobId: string
  ): Promise<void> {
    const key = NullifierSetManager.nullifierKey(nullifier);
    await this.redis.set(key, jobId);
  }

  protected async hasNullifierConflict(nullifier: bigint): Promise<boolean> {
    const key = NullifierSetManager.nullifierKey(nullifier);
    return (await this.redis.get(key)) != undefined;
  }
}
