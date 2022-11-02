import { FlaxDB } from "../db";
import { IncludedNoteStruct } from "../note";

export type RefundEvent = IncludedNoteStruct;
export interface SpendEvent {
  oldNoteNullifier: bigint;
  valueSpent: bigint;
  merkleIndex: number;
}

export abstract class NotesManager {
  db: FlaxDB;

  constructor(db: FlaxDB) {
    this.db = db;
  }

  abstract fetchNotesFromRefunds(): Promise<RefundEvent[]>;
  abstract postStoreNotesFromRefunds(): Promise<void>;
  abstract fetchSpends(): Promise<SpendEvent[]>;
  abstract postApplySpends(): Promise<void>;

  async fetchAndStoreNewNotesFromRefunds(): Promise<void> {}
  async fetchAndApplyNewSpends(): Promise<void> {}
}

export { LocalNotesManager } from "./local";
