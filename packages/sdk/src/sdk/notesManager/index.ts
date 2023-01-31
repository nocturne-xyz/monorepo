import { NotesDB } from "../db";
import { IncludedNote, NoteTrait } from "../note";
import { NocturneSigner } from "../signer";
import {
  decodeAsset,
  Asset,
  BaseJoinSplitTx,
  NoteTransmission,
} from "../../commonTypes";

export interface JoinSplitEvent {
  oldNoteANullifier: bigint;
  oldNoteBNullifier: bigint;
  newNoteAIndex: number;
  newNoteBIndex: number;
  joinSplitTx: BaseJoinSplitTx;
}

export abstract class NotesManager {
  protected db: NotesDB;
  protected signer: NocturneSigner;

  constructor(db: NotesDB, signer: NocturneSigner) {
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
    const ownedNotes = newNotes.filter((refund) => {
      return this.signer.testOwn(refund.owner);
    });
    console.log("[Refunds] Fetched notes:", newNotes);
    console.log("[Refunds] Owned notes:", ownedNotes);
    await this.storeNewNotesFromRefunds(ownedNotes);
    await this.postStoreNotesFromRefunds();
  }

  private async applyNewJoinSplits(
    newJoinSplits: JoinSplitEvent[]
  ): Promise<void> {
    const allNotes = [...(await this.db.getAllNotes()).values()].flat();
    for (const e of newJoinSplits) {
      const asset = decodeAsset(
        e.joinSplitTx.encodedAsset.encodedAssetAddr,
        e.joinSplitTx.encodedAsset.encodedAssetId
      );

      await this.processNoteTransmission(
        e.joinSplitTx.newNoteACommitment,
        e.joinSplitTx.newNoteATransmission,
        e.newNoteAIndex,
        asset
      );

      await this.processNoteTransmission(
        e.joinSplitTx.newNoteBCommitment,
        e.joinSplitTx.newNoteBTransmission,
        e.newNoteBIndex,
        asset
      );
    }

    for (const e of newJoinSplits) {
      // Delete nullified notes
      for (const oldNote of allNotes) {
        // TODO implement note indexing by nullifiers
        const oldNullifier = this.signer.createNullifier(oldNote);
        console.log("Nullifier for old note:", oldNullifier);
        if (
          oldNullifier == e.oldNoteANullifier ||
          oldNullifier == e.oldNoteBNullifier
        ) {
          console.log("Removing for old note with nf:", oldNullifier);
          await this.db.removeNote(oldNote);
        }
      }
    }
  }

  private async processNoteTransmission(
    newNoteCommitment: bigint,
    newNoteTransmission: NoteTransmission,
    newNoteIndex: number,
    asset: Asset
  ): Promise<void> {
    if (this.signer.testOwn(newNoteTransmission.owner)) {
      const newNote = this.signer.getNoteFromNoteTransmission(
        newNoteTransmission,
        newNoteIndex,
        asset
      );

      // Check commitment against note, as malicious user could post incorrectly
      // encrypted note
      if (
        newNote.value > 0n &&
        NoteTrait.toCommitment(newNote) == newNoteCommitment
      ) {
        console.log("Storing new note:", newNote);
        await this.db.storeNote(newNote);
      }
    }
  }

  async fetchAndApplyNewJoinSplits(): Promise<void> {
    const newJoinSplits = await this.fetchJoinSplits();
    console.log("[JoinSplits] New joinsplits:", newJoinSplits);
    await this.applyNewJoinSplits(newJoinSplits);
    await this.postApplyJoinSplits();
  }
}

export { LocalNotesManager } from "./local";
export { MockNotesManager } from "./mock";
