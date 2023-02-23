import { NotesDB } from "../db";
import {
  IncludedNote,
  NoteTrait,
  NocturneViewer,
  Asset,
  AssetTrait,
  BaseJoinSplit,
  EncryptedNote,
} from "@nocturne-xyz/primitives";

export interface JoinSplitEvent {
  oldNoteANullifier: bigint;
  oldNoteBNullifier: bigint;
  newNoteAIndex: number;
  newNoteBIndex: number;
  joinSplit: BaseJoinSplit;
}

export abstract class NotesManager {
  protected db: NotesDB;
  protected viewer: NocturneViewer;

  constructor(db: NotesDB, viewer: NocturneViewer) {
    this.db = db;
    this.viewer = viewer;
  }

  protected abstract fetchNotesFromRefunds(): Promise<IncludedNote[]>;
  protected abstract postStoreNotesFromRefunds(): Promise<void>;
  protected abstract fetchJoinSplits(): Promise<JoinSplitEvent[]>;
  protected abstract postApplyJoinSplits(): Promise<void>;

  private async storeNewNotesFromRefunds(
    newNotesFromRefunds: IncludedNote[]
  ): Promise<void> {
    const withNullifiers = newNotesFromRefunds.map((note) => ({
      ...note,
      nullifier: this.viewer.createNullifier(note),
    }));
    await this.db.storeNotesAndCommitments(withNullifiers);
  }

  async fetchAndStoreNewNotesFromRefunds(): Promise<void> {
    const newNotes = await this.fetchNotesFromRefunds();
    const ownedNotes = newNotes.filter((refund) => {
      return this.viewer.isOwnAddress(refund.owner);
    });
    console.log("[Refunds] Owned notes:", ownedNotes);
    await this.storeNewNotesFromRefunds(ownedNotes);
    await this.postStoreNotesFromRefunds();
  }

  private async applyNewJoinSplits(
    newJoinSplits: JoinSplitEvent[]
  ): Promise<void> {
    const nullifiers = [];
    for (const e of newJoinSplits) {
      const asset = AssetTrait.decode(e.joinSplit.encodedAsset);

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

      nullifiers.push(e.joinSplit.nullifierA, e.joinSplit.nullifierB);
    }

    await this.db.removeNotesByNullifiers(nullifiers);
  }

  private async processEncryptedNote(
    newNoteCommitment: bigint,
    newEncryptedNote: EncryptedNote,
    newNoteIndex: number,
    asset: Asset
  ): Promise<void> {
    if (this.viewer.isOwnAddress(newEncryptedNote.owner)) {
      const newNote = this.viewer.getNoteFromEncryptedNote(
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
        // temporary kludge until we get rid of `NotesManager` in the next few PRs
        const nullifier = this.viewer.createNullifier(newNote);
        const newNoteWithNullifier = NoteTrait.toIncludedNoteWithNullifier(
          newNote,
          nullifier
        );
        await this.db.storeNotesAndCommitments([newNoteWithNullifier]);
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
