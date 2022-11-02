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

  abstract fetchAndStoreRefunds(): Promise<void>;
  abstract fetchAndApplySpends(): Promise<void>;
}

export { LocalNotesManager } from "./local";
