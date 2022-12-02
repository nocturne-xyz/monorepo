import { NocturneDB } from "../db";
import { IncludedNote, noteToCommitment } from "../note";
import { NocturneSigner } from "../signer";
import { Address, BaseJoinSplitTx, NoteTransmission } from "../../commonTypes";

export interface JoinSplitEvent {
  oldNoteANullifier: bigint;
  oldNoteBNullifier: bigint;
  newNoteAIndex: number;
  newNoteBIndex: number;
  joinSplitTx: BaseJoinSplitTx;
}

export abstract class NotesManager {
  protected db: NocturneDB;
  protected signer: NocturneSigner;

  constructor(db: NocturneDB, signer: NocturneSigner) {
    this.db = db;
    this.signer = signer;
  }

  protected abstract fetchNotesFromRefunds(): Promise<IncludedNote[]>;
  protected abstract postStoreNotesFromRefunds(): Promise<void>;
  protected abstract fetchJoinSplits(): Promise<JoinSplitEvent[]>;
  protected abstract postApplyJoinSplits(): Promise<void>;

  private async storeNewNotesFromRefunds(
    newNotesFromRefunds: IncludedNote[]
  ): Promise<void> {
    await this.db.storeNotes(newNotesFromRefunds);
  }

  async fetchAndStoreNewNotesFromRefunds(): Promise<void> {
    const newNotes = await this.fetchNotesFromRefunds();
    await this.storeNewNotesFromRefunds(newNotes);
    await this.postStoreNotesFromRefunds();
  }

  private async applyNewJoinSplits(
    newJoinSplits: JoinSplitEvent[]
  ): Promise<void> {
    const allNotes = [...(await this.db.getAllNotes()).values()].flat();
    for (const e of newJoinSplits) {
      // Delete nullified notes
      for (const oldNote of allNotes) {
        // TODO implement note indexing by nullifiers
        const oldNullifier = this.signer.createNullifier(oldNote);
        if (
          oldNullifier == e.oldNoteANullifier ||
          oldNullifier == e.oldNoteBNullifier
        ) {
          await this.db.removeNote(oldNote);
        }
      }

      this.processNoteTransmission(
        e.joinSplitTx.newNoteACommitment,
        e.joinSplitTx.newNoteATransmission,
        e.newNoteAIndex,
        e.joinSplitTx.asset,
        e.joinSplitTx.id
      );

      this.processNoteTransmission(
        e.joinSplitTx.newNoteBCommitment,
        e.joinSplitTx.newNoteBTransmission,
        e.newNoteBIndex,
        e.joinSplitTx.asset,
        e.joinSplitTx.id
      );
    }
  }

  private async processNoteTransmission(
    newNoteCommitment: bigint,
    newNoteTransmission: NoteTransmission,
    newNoteIndex: number,
    asset: Address,
    id: bigint
  ): Promise<void> {
    if (this.signer.testOwn(newNoteTransmission.owner)) {
      const newNote = this.signer.getNoteFromNoteTransmission(
        newNoteTransmission,
        newNoteIndex,
        asset,
        id
      );
      if (
        newNote.value > 0n &&
        noteToCommitment(newNote) == newNoteCommitment
      ) {
        await this.db.storeNote(newNote);
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
