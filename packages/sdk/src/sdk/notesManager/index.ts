import { NocturneDB } from "../db";
import { IncludedNote, IncludedNoteStruct } from "../note";
import { NocturneSigner } from "../signer";

export interface JoinSplitEvent {
  oldNoteNullifier: bigint;
  valueSpent: bigint;
  merkleIndex: number;
}

export abstract class NotesManager {
  protected db: NocturneDB;
  protected signer: NocturneSigner;

  constructor(db: NocturneDB, signer: NocturneSigner) {
    this.db = db;
    this.signer = signer;
  }

  protected abstract fetchNotesFromRefunds(): Promise<IncludedNoteStruct[]>;
  protected abstract postStoreNotesFromRefunds(): Promise<void>;
  protected abstract fetchJoinSplits(): Promise<JoinSplitEvent[]>;
  protected abstract postApplyJoinSplits(): Promise<void>;

  private async storeNewNotesFromRefunds(
    newNotesFromRefunds: IncludedNoteStruct[]
  ): Promise<void> {
    await this.db.storeNotes(newNotesFromRefunds);
  }

  async fetchAndStoreNewNotesFromRefunds(): Promise<void> {
    const newNotes = await this.fetchNotesFromRefunds();
    await this.storeNewNotesFromRefunds(newNotes);
    await this.postStoreNotesFromRefunds();
  }

  private async applyNewJoinSplits(newJoinSplits: JoinSplitEvent[]): Promise<void> {
    const allNotes = [...(await this.db.getAllNotes()).values()].flat();
    for (const joinSplit of newJoinSplits) {
      for (const oldNote of allNotes) {
        // TODO implement note indexing by nullifiers
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

  async fetchAndApplyNewJoinSplits(): Promise<void> {
    const newJoinSplits = await this.fetchJoinSplits();
    await this.applyNewJoinSplits(newJoinSplits);
    await this.postApplyJoinSplits();
  }
}

export { LocalNotesManager } from "./local";
export { MockNotesManager } from "./mock";
