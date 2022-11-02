import { FlaxDB } from "../db";
import { IncludedNote, IncludedNoteStruct } from "../note";
import { FlaxSigner } from "../signer";

export type RefundEvent = IncludedNoteStruct;
export interface SpendEvent {
  oldNoteNullifier: bigint;
  valueSpent: bigint;
  merkleIndex: number;
}

export abstract class NotesManager {
  db: FlaxDB;
  signer: FlaxSigner;

  constructor(db: FlaxDB, signer: FlaxSigner) {
    this.db = db;
    this.signer = signer;
  }

  abstract fetchNotesFromRefunds(): Promise<IncludedNoteStruct[]>;
  abstract postStoreNotesFromRefunds(): Promise<void>;
  abstract fetchSpends(): Promise<SpendEvent[]>;
  abstract postApplySpends(): Promise<void>;

  // TODO: hide unused methods as private
  async storeNewNotesFromRefunds(
    newNotesFromRefunds: IncludedNoteStruct[]
  ): Promise<void> {
    await this.db.storeNotes(newNotesFromRefunds);
  }

  async fetchAndStoreNewNotesFromRefunds(): Promise<void> {
    const newNotes = await this.fetchNotesFromRefunds();
    await this.storeNewNotesFromRefunds(newNotes);
    await this.postStoreNotesFromRefunds();
  }

  async applyNewSpends(newSpends: SpendEvent[]): Promise<void> {
    const allNotes = [...this.db.getAllNotes().values()].flat();
    for (const spend of newSpends) {
      for (const oldNote of allNotes) {
        const oldNullifier = this.signer.createNullifier(
          new IncludedNote(oldNote)
        );
        if (oldNullifier == spend.oldNoteNullifier) {
          const newNoteNonce = this.signer.generateNewNonce(oldNullifier);
          const newNote: IncludedNoteStruct = {
            owner: oldNote.owner,
            nonce: newNoteNonce,
            asset: oldNote.asset,
            id: oldNote.id,
            value: oldNote.value - spend.valueSpent,
            merkleIndex: spend.merkleIndex,
          };

          await this.db.removeNote(oldNote);
          await this.db.storeNote(newNote);
        }
      }
    }
  }

  async fetchAndApplyNewSpends(): Promise<void> {
    const newSpends = await this.fetchSpends();
    await this.applyNewSpends(newSpends);
    await this.postApplySpends();
  }
}

export { LocalNotesManager } from "./local";
