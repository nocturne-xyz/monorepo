import {
  KVStore,
  OperationStatus,
  OperationTrait,
  SubmittableOperationWithNetworkInfo,
} from "@nocturne-xyz/core";
import { OperationMetadata } from "./types";
import { Mutex } from "async-mutex";
import * as JSON from "bigint-json-serialization";

const OP_HISTORY_KEY = "OP_HISTORY";
const OP_DIGEST_PREFIX = "OP_DIGEST_";

function formatOpHistoryRecordKey(digest: bigint): string {
  return `${OP_DIGEST_PREFIX}${digest.toString()}`;
}

export type OpHistoryRecord = {
  digest: bigint;
  op: SubmittableOperationWithNetworkInfo;
  metadata: OperationMetadata;

  status?: OperationStatus;

  createdAt: number;
  lastModified: number;
};

export class OpHistoryStore {
  // two sets of stores:
  // digest => record
  // HISTORY => [digest]
  protected kv: KVStore;
  protected mutex: Mutex;

  constructor(kv: KVStore) {
    this.kv = kv;
    this.mutex = new Mutex();
  }

  protected async getRecord(
    digest: bigint
  ): Promise<OpHistoryRecord | undefined> {
    const key = formatOpHistoryRecordKey(digest);
    const value = await this.kv.getString(key);
    if (value === undefined) {
      return undefined;
    }

    return JSON.parse(value);
  }

  protected async setRecord(
    digest: bigint,
    record: OpHistoryRecord
  ): Promise<void> {
    const key = formatOpHistoryRecordKey(digest);
    const value = JSON.stringify(record);
    await this.kv.putString(key, value);
  }

  protected async getHistoryArray(): Promise<bigint[]> {
    const value = await this.kv.getString(OP_HISTORY_KEY);
    if (value === undefined) {
      return [];
    }

    return JSON.parse(value);
  }

  protected async setHistoryArray(history: bigint[]): Promise<void> {
    const value = JSON.stringify(history);
    await this.kv.putString(OP_HISTORY_KEY, value);
  }

  async getHistory(): Promise<OpHistoryRecord[]> {
    return await this.mutex.runExclusive(async () => {
      const history = await this.getHistoryArray();
      const records = await Promise.all(
        history.map((digest) => this.getRecord(BigInt(digest)))
      );

      // if any record is missing, sometheing bad happened
      if (records.some((r) => r === undefined)) {
        throw new Error("missing record!");
      }

      return records as OpHistoryRecord[];
    });
  }

  async getHistoryRecord(digest: bigint): Promise<OpHistoryRecord | undefined> {
    return await this.mutex.runExclusive(
      async () => await this.getRecord(digest)
    );
  }

  async setStatus(opDigest: bigint, status: OperationStatus): Promise<void> {
    await this.mutex.runExclusive(async () => {
      const record = await this.getRecord(opDigest);
      if (record === undefined) {
        throw new Error("record not found");
      }

      record.status = status;
      record.lastModified = Date.now();

      await this.setRecord(opDigest, record);
    });
  }

  async push(
    op: SubmittableOperationWithNetworkInfo,
    metadata: OperationMetadata
  ): Promise<void> {
    await this.mutex.runExclusive(async () => {
      const record = {
        digest: OperationTrait.computeDigest(op),
        op,
        metadata,
        createdAt: Date.now(),
        lastModified: Date.now(),
      };

      await this.setRecord(record.digest, record);

      const history = await this.getHistoryArray();
      history.push(record.digest);
      await this.setHistoryArray(history);
    });
  }
}
