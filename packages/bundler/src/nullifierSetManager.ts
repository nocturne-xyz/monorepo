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

  async extractNullifierConflictError(
    operation: ProvenOperation
  ): Promise<string | undefined> {
    const opNfSet = new Set<bigint>();

    // Ensure no overlap in given operation
    operation.joinSplitTxs.forEach(({ nullifierA, nullifierB }) => {
      if (opNfSet.has(nullifierA)) {
        return `Conflicting nullifier in operation: ${nullifierA}`;
      }
      opNfSet.add(nullifierA);

      if (opNfSet.has(nullifierB)) {
        return `Conflicting nullifier in operation: ${nullifierB}`;
      }
      opNfSet.add(nullifierB);
    });

    // Ensure no overlap with other nfs already in queue
    for (const nf of opNfSet) {
      const conflict = await this.hasNullifierConflict(nf);
      if (conflict) {
        return `Nullifier already in other operation in queue: ${nf}`;
      }
    }

    return undefined;
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

  private async addNullifier(nullifier: bigint, jobId: string): Promise<void> {
    const key = NullifierSetManager.nullifierKey(nullifier);
    await this.redis.set(key, jobId);
  }

  private async hasNullifierConflict(nullifier: bigint): Promise<boolean> {
    const key = NullifierSetManager.nullifierKey(nullifier);
    return (await this.redis.get(key)) != undefined;
  }
}
