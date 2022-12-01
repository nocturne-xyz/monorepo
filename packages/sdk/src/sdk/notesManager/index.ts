import { NocturneDB } from "../db";
import {
  IncludedNote,
  IncludedNoteStruct,
} from "../note";
import { NocturneSigner } from "../signer";
import { BaseJoinSplitTx } from "../../contract/types";

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
    for (const e of newJoinSplits) {
      // Delete nullified notes
      for (const oldNote of allNotes) {
        // TODO implement note indexing by nullifiers
        const oldNullifier = this.signer.createNullifier(new IncludedNote(oldNote));
        if (oldNullifier == e.oldNoteANullifier ||
           oldNullifier == e.oldNoteBNullifier) {
          await this.db.removeNote(oldNote);
        }
      }

      // Test if newNoteA is for us
      if (this.signer.testOwn(e.joinSplitTx.newNoteAOwner)) {
        const [nonce, value] = this.signer.decryptNote(
          e.joinSplitTx.encappedKeyA,
          e.joinSplitTx.encryptedNoteA
        );
        const newNoteA: IncludedNoteStruct = {
          owner: this.signer.privkey.toCanonAddressStruct(),
          nonce,
          asset: e.joinSplitTx.asset,
          id: e.joinSplitTx.id,
          value,
          merkleIndex: e.newNoteAIndex,
        };
        if ((newNoteA.value > 0n) &&
            (new IncludedNote(newNoteA)).toCommitment()
              == e.joinSplitTx.newNoteACommitment) {
          await this.db.storeNote(newNoteA);
        }
      }

      // Test if newNoteB is for us
      if (this.signer.testOwn(e.joinSplitTx.newNoteBOwner)) {
        const [nonce, value] = this.signer.decryptNote(
          e.joinSplitTx.encappedKeyB,
          e.joinSplitTx.encryptedNoteB
        );
        const newNoteB = new IncludedNote({
          owner: this.signer.privkey.toCanonAddressStruct(),
          nonce,
          asset: e.joinSplitTx.asset,
          id: e.joinSplitTx.id,
          value,
          merkleIndex: e.newNoteAIndex,
        });
        if ((newNoteB.value > 0n) &&
            (new IncludedNote(newNoteB)).toCommitment()
              == e.joinSplitTx.newNoteBCommitment) {
          await this.db.storeNote(newNoteB);
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
