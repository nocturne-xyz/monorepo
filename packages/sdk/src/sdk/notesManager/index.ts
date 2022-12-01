import { NocturneDB } from "../db";
import {
  IncludedNote,
  IncludedNoteStruct,
  EncryptedNote,
  EncappedKey
} from "../note";
import { NocturneSigner } from "../signer";
import { NocturneAddressStruct } from "../../crypto/address";
import { Address, BaseJoinSplitTx } from "../../commonTypes";

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

      this.processNewEncryptedNote(
        e.joinSplitTx.newNoteACommitment,
        e.joinSplitTx.newNoteAOwner,
        e.joinSplitTx.encappedKeyA,
        e.joinSplitTx.encryptedNoteA,
        e.newNoteAIndex,
        e.joinSplitTx.asset,
        e.joinSplitTx.id,
      );

      this.processNewEncryptedNote(
        e.joinSplitTx.newNoteBCommitment,
        e.joinSplitTx.newNoteBOwner,
        e.joinSplitTx.encappedKeyB,
        e.joinSplitTx.encryptedNoteB,
        e.newNoteBIndex,
        e.joinSplitTx.asset,
        e.joinSplitTx.id,
      );
    }
  }

  private async processNewEncryptedNote(
    newNoteCommitment: BigInt,
    owner: NocturneAddressStruct,
    encappedKey: EncappedKey,
    encryptedNote: EncryptedNote,
    newNoteIndex: number,
    asset: Address,
    id: bigint
  ): Promise<void> {
    if (this.signer.testOwn(owner)) {
      const [nonce, value] = this.signer.decryptNote(
        encappedKey,
        encryptedNote
      );
      const newNote = {
        owner: this.signer.privkey.toCanonAddressStruct(),
        nonce,
        asset: asset,
        id: id,
        value,
        merkleIndex: newNoteIndex,
      };
      if ((newNote.value > 0n) &&
          (new IncludedNote(newNote)).toCommitment()
            == newNoteCommitment) {
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
