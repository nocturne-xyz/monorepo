import { NotesDB } from "../db";
import { IncludedNote, NoteTrait } from "../note";
import { NocturneSigner } from "../signer";
import { Asset, AssetTrait } from "../asset";
import {
  BaseJoinSplit,
  EncryptedNote,
} from "../../commonTypes";

export interface JoinSplitEvent {
  oldNoteANullifier: bigint;
  oldNoteBNullifier: bigint;
  newNoteAIndex: number;
  newNoteBIndex: number;
  joinSplit: BaseJoinSplit;
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
    console.log("[Refunds] Owned notes:", ownedNotes);
    await this.storeNewNotesFromRefunds(ownedNotes);
    await this.postStoreNotesFromRefunds();
  }

  private async applyNewJoinSplits(
    newJoinSplits: JoinSplitEvent[]
  ): Promise<void> {
    for (const e of newJoinSplits) {
      const asset = AssetTrait.decode(
        e.joinSplit.encodedAsset
      );

      await this.processEncryptedNote(
        e.joinSplit.newNoteACommitment,
        e.joinSplit.newNoteAEncrypted,
        e.newNoteAIndex,
        asset
      );

      await this.processEncryptedNote(
        e.joinSplit.newNoteBCommitment,
        e.joinSplit.newNoteBEncrypted,
        e.newNoteBIndex,
        asset
      );
    }

    const allNotesUpdated = [...(await this.db.getAllNotes()).values()].flat();
    for (const e of newJoinSplits) {
      // Delete nullified notes
      for (const oldNote of allNotesUpdated) {
        // TODO implement note indexing by nullifiers
        const oldNullifier = this.signer.createNullifier(oldNote);
        if (
          oldNullifier == e.oldNoteANullifier ||
          oldNullifier == e.oldNoteBNullifier
        ) {
          await this.db.removeNote(oldNote);
        }
      }
    }
  }

  private async processEncryptedNote(
    newNoteCommitment: bigint,
    newEncryptedNote: EncryptedNote,
    newNoteIndex: number,
    asset: Asset
  ): Promise<void> {
    if (this.signer.testOwn(newEncryptedNote.owner)) {
      const newNote = this.signer.getNoteFromEncryptedNote(
        newEncryptedNote,
        newNoteIndex,
        asset
      );

      // Check commitment against note, as malicious user could post incorrectly
      // encrypted note
      if (
        newNote.value > 0n &&
        NoteTrait.toCommitment(newNote) == newNoteCommitment
      ) {
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

export { DefaultNotesManager } from "./default";
export { MockNotesManager } from "./mock";
