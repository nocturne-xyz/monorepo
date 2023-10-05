import {
  OperationTrait,
  SubmittableOperationWithNetworkInfo,
} from "@nocturne-xyz/core";
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
    operation: SubmittableOperationWithNetworkInfo
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
    operation: SubmittableOperationWithNetworkInfo
  ): RedisTransaction[] {
    const digest = OperationTrait.computeDigest(operation).toString();

    const allJoinSplits = [
      ...operation.confJoinSplits,
      ...operation.pubJoinSplits.map((pubJoinSplit) => pubJoinSplit.joinSplit),
    ];

    return allJoinSplits.flatMap(({ nullifierA, nullifierB }) => {
      return [
        this.getAddNullifierTransaction(nullifierA, digest),
        this.getAddNullifierTransaction(nullifierB, digest),
      ];
    });
  }

  getRemoveNullifierTransactions(
    operation: SubmittableOperationWithNetworkInfo
  ): RedisTransaction[] {
    const allJoinSplits = [
      ...operation.confJoinSplits,
      ...operation.pubJoinSplits.map((pubJoinSplit) => pubJoinSplit.joinSplit),
    ];

    return allJoinSplits.flatMap(({ nullifierA, nullifierB }) => {
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
