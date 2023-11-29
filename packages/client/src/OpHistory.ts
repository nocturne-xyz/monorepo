import {
  KVStore,
  MerkleIndex,
  OperationStatus,
  OperationTrait,
  PreSignOperation,
  SignedOperation,
  unzip,
} from "@nocturne-xyz/core";
import { OpHistoryRecord, OperationMetadata } from "./types";
import {
  OPTIMISTIC_RECORD_TTL,
  getMerkleIndicesAndNfsFromOp,
  isTerminalOpStatus,
} from "./utils";
import * as JSON from "bigint-json-serialization";

const OP_HISTORY_KEY = "op_history";

type ExpirationDate = number;

export class OpHistory {
  private kv: KVStore;
  private optimisticNfs: Map<MerkleIndex, ExpirationDate>;
  private _opHistory: OpHistoryRecord[];

  constructor(kv: KVStore) {
    this.kv = kv;
    this.optimisticNfs = new Map();
    this._opHistory = [];
  }

  public static async load(kv: KVStore): Promise<OpHistory> {
    const serializedState = await kv.getString(OP_HISTORY_KEY);
    if (!serializedState) {
      return new OpHistory(kv);
    }

    const [opHistory, optimisticNfs] = JSON.parse(serializedState) as [
      OpHistoryRecord[],
      [MerkleIndex, ExpirationDate][]
    ];
    const res = new OpHistory(kv);
    res._opHistory = opHistory;
    res.optimisticNfs = new Map(optimisticNfs);
    return res;
  }

  private async persist(): Promise<void> {
    await this.kv.putString(
      OP_HISTORY_KEY,
      JSON.stringify([this.opHistory, Array.from(this.optimisticNfs.entries())])
    );
  }

  get opHistory(): OpHistoryRecord[] {
    return this._opHistory;
  }

  get pendingOps(): OpHistoryRecord[] {
    return this._opHistory.filter(
      (record) => !record.status || !isTerminalOpStatus(record.status)
    );
  }

  get previousOps(): OpHistoryRecord[] {
    return this._opHistory.filter(
      (record) => record.status && isTerminalOpStatus(record.status)
    );
  }

  public hasOptimisticNf(merkleIndex: MerkleIndex): boolean {
    return this.optimisticNfs.has(merkleIndex);
  }

  public getOpHistoryRecord(digest: bigint): OpHistoryRecord | undefined {
    return this.opHistory.find((record) => record.digest === digest);
  }

  public async setStatusForOp(
    digest: bigint,
    status: OperationStatus
  ): Promise<void> {
    const idx = this.opHistory.findIndex((record) => record.digest === digest);
    if (idx < 0) {
      console.warn("op history record not found");
      return;
    }

    this._opHistory[idx].status = status;

    await this.persist();
  }

  public async add(
    op: PreSignOperation | SignedOperation,
    metadata: OperationMetadata,
    status?: OperationStatus
  ): Promise<void> {
    const digest = OperationTrait.computeDigest(op);

    // see if op already exists. if so, skip
    if (this.getOpHistoryRecord(digest) !== undefined) {
      return;
    }

    const pairs: [number, bigint][] = getMerkleIndicesAndNfsFromOp(op).map(
      ({ merkleIndex, nullifier }) => [Number(merkleIndex), nullifier]
    );
    const [spentNoteMerkleIndices] = unzip(pairs);
    const now = Date.now();

    const record = {
      digest,
      metadata,
      status,
      spentNoteMerkleIndices,
      createdAt: now,
      lastModified: now,
    };
    this._opHistory.push(record);

    const expirationDate = now + OPTIMISTIC_RECORD_TTL;
    for (const idx of spentNoteMerkleIndices) {
      this.optimisticNfs.set(idx, expirationDate);
    }

    await this.persist();
  }

  public async remove(
    digest: bigint,
    removeOptimisticNfs?: boolean
  ): Promise<void> {
    const index = this.opHistory.findIndex(
      (record) => record.digest === digest
    );
    if (index === -1) {
      return;
    }

    if (removeOptimisticNfs) {
      const record = this.opHistory[index];
      for (const idx of record.spentNoteMerkleIndices) {
        this.optimisticNfs.delete(idx);
      }
    }

    this.opHistory.splice(index, 1);
    await this.persist();
  }

  public async pruneOptimisticNFs(): Promise<void> {
    const now = Date.now();
    for (const [merkleIndex, expirationDate] of this.optimisticNfs.entries()) {
      if (now > expirationDate) {
        this.optimisticNfs.delete(merkleIndex);
      }
    }

    await this.persist();
  }

  // for test purposes only
  get __optimisticNfs(): Map<MerkleIndex, ExpirationDate> {
    return this.optimisticNfs;
  }
}
