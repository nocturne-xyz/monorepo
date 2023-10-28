import {
  KVStore,
  OperationTrait,
  SubmittableOperationWithNetworkInfo,
} from "@nocturne-xyz/core";
import { OperationMetadata } from "./types";
import * as JSON from "bigint-json-serialization";

const OP_HISTORY_KEY = "OP_HISTORY";

export type OpHistoryRecord = {
  digest: bigint;
  op: SubmittableOperationWithNetworkInfo;
  metadata: OperationMetadata;

  createdAt: number;
};

export class OpHistoryStore {
  protected kv: KVStore;

  constructor(kv: KVStore) {
    this.kv = kv;
  }

  async getHistory(): Promise<OpHistoryRecord[]> {
    const history = await this.kv.getString(OP_HISTORY_KEY);
    if (!history) {
      return [];
    }

    return JSON.parse(history);
  }

  protected async setHistory(history: OpHistoryRecord[]): Promise<void> {
    await this.kv.putString(OP_HISTORY_KEY, JSON.stringify(history));
  }

  async push(
    op: SubmittableOperationWithNetworkInfo,
    metadata: OperationMetadata
  ): Promise<void> {
    const digest = OperationTrait.computeDigest(op);
    const record: OpHistoryRecord = {
      digest,
      op,
      metadata,
      createdAt: Date.now(),
    };

    const history = await this.getHistory();
    history.push(record);
    await this.setHistory(history);
  }
}
