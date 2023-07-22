import {
  computeOperationDigest,
  OnchainProvenOperationWithNetworkInfo,
} from "@nocturne-xyz/sdk";
import IORedis from "ioredis";
import { RedisTransaction } from ".";

const NULLIFIER_PREFIX = "NULLIFIER_";

export class NullifierDB {
  redis: IORedis;

  constructor(redis: IORedis) {
    this.redis = redis;
  }

  private static nullifierKey(nullifier: bigint): string {
    return NULLIFIER_PREFIX + nullifier.toString();
  }

  async addNullifiers(
    operation: OnchainProvenOperationWithNetworkInfo
  ): Promise<void> {
    const addNfTransactions = this.getAddNullifierTransactions(operation);
    await this.redis.multi(addNfTransactions).exec((maybeErr) => {
      if (maybeErr) {
        throw Error(
          `nullifier set manager add nf transaction failed: ${maybeErr}`
        );
      }
    });
  }

  async addNullifier(nullifier: bigint, jobId: string): Promise<void> {
    const key = NullifierDB.nullifierKey(nullifier);
    await this.redis.set(key, jobId);
  }

  async hasNullifierConflict(nullifier: bigint): Promise<boolean> {
    const key = NullifierDB.nullifierKey(nullifier);
    return (await this.redis.get(key)) != undefined;
  }

  getAddNullifierTransactions(
    operation: OnchainProvenOperationWithNetworkInfo
  ): RedisTransaction[] {
    const digest = computeOperationDigest(operation).toString();
    return operation.joinSplits.flatMap(({ nullifierA, nullifierB }) => {
      return [
        this.getAddNullifierTransaction(nullifierA, digest),
        this.getAddNullifierTransaction(nullifierB, digest),
      ];
    });
  }

  getRemoveNullifierTransactions(
    operation: OnchainProvenOperationWithNetworkInfo
  ): RedisTransaction[] {
    return operation.joinSplits.flatMap(({ nullifierA, nullifierB }) => {
      return [
        this.getRemoveNullifierTransaction(nullifierA),
        this.getRemoveNullifierTransaction(nullifierB),
      ];
    });
  }

  getRemoveNullifierTransaction(nullifier: bigint): RedisTransaction {
    const key = NullifierDB.nullifierKey(nullifier);
    return ["del", key];
  }

  getAddNullifierTransaction(
    nullifier: bigint,
    jobId: string
  ): RedisTransaction {
    const key = NullifierDB.nullifierKey(nullifier);
    return ["set", key, jobId];
  }
}
