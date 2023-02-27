import { NocturneViewer } from "./crypto";
import { NocturneDB } from "./NocturneDB";
import { MerkleProver } from "./merkleProver";
import {
  ClosableAsyncIterator,
  EncryptedStateDiff,
  StateDiff,
  SyncAdapter,
} from "./sync";
import { ethers } from "ethers";
import { IncludedEncryptedNote, IncludedNote, NoteTrait } from "./primitives";

// TODO mess with these
const NOTES_MAX_CHUNK_SIZE = 10000;
const MERKLE_MAX_CHUNK_SIZE = 10000;

export interface SyncOpts {
  // defaults to `false`.
  // If this is set to `true`, `sync` will only update the DB
  // and will not update the in-memory tree.
  skipMerkleProverUpdates: boolean;
}

// this should be the only thing that writes to `nocturneDB` and `merkleProver`
export class NocturneSyncer {
  private viewer: NocturneViewer;
  private adapter: SyncAdapter;
  private nocturneDB: NocturneDB;
  private merkle: MerkleProver;
  private provider: ethers.providers.Provider;

  constructor(
    viewer: NocturneViewer,
    adapter: SyncAdapter,
    nocturneDB: NocturneDB,
    merkle: MerkleProver,
    provider: ethers.providers.Provider
  ) {
    this.viewer = viewer;
    this.adapter = adapter;
    this.nocturneDB = nocturneDB;
    this.merkle = merkle;
    this.provider = provider;
  }

  async sync(opts?: SyncOpts): Promise<void> {
    const nextBlockToSync = await this.nocturneDB.nextBlock();
    const currentBlock = await this.provider.getBlockNumber();
    console.log(`Syncing from block ${nextBlockToSync} to ${currentBlock}...`);

    const newDiffs = await this.adapter.iterStateDiffs(nextBlockToSync, {
      maxChunkSize: NOTES_MAX_CHUNK_SIZE,
      endBlock: currentBlock,
    });

    // decrypt notes and compute nullifiers
    const diffs: ClosableAsyncIterator<StateDiff> = newDiffs.map((diff) =>
      this.decryptStateDiff(diff)
    );

    // update merkle tree to current
    for await (const diff of diffs.iter) {
      await this.nocturneDB.applyStateDiff(diff);
    }

    if (!opts?.skipMerkleProverUpdates) {
      await this.updateMerkle();
    }
  }

  private async updateMerkle(): Promise<void> {
    while (true) {
      const start = await this.merkle.count();
      const end = start + MERKLE_MAX_CHUNK_SIZE;
      const newLeaves = await this.nocturneDB.getNoteCommitmentsByIndexRange(
        start,
        end
      );

      if (newLeaves.length === 0) {
        return;
      }

      for (const { merkleIndex, noteCommitment } of newLeaves) {
        await this.merkle.insert(merkleIndex, noteCommitment);
      }
    }
  }

  private decryptStateDiff({
    notes,
    nullifiers,
    nextMerkleIndex,
    blockNumber,
  }: EncryptedStateDiff): StateDiff {
    const notesAndCommitments = notes.map((note) => {
      const isOwn = this.viewer.isOwnAddress(note.owner);
      const isEncrypted = NoteTrait.isEncryptedNote(note);

      if (isOwn && isEncrypted) {
        // if it's ours and its encrypted, decrypt it, get the nullifier, and return it
        const { merkleIndex, asset, ...encryptedNote } =
          note as IncludedEncryptedNote;
        const includedNote = this.viewer.getNoteFromEncryptedNote(
          encryptedNote,
          merkleIndex,
          asset
        );
        const nullifier = this.viewer.createNullifier(includedNote);
        return { ...includedNote, nullifier };
      } else if (isOwn && !isEncrypted) {
        // if it's ours and it's not encrypted, get the nullifier and return it
        const includedNote = note as IncludedNote;
        const nullifier = this.viewer.createNullifier(includedNote);
        return { ...includedNote, nullifier };
      } else if (!isOwn && isEncrypted) {
        // if it's not ours and it's encrypted, return the given commitment
        const encryptedNote = note as IncludedEncryptedNote;
        return {
          noteCommitment: encryptedNote.commitment,
          merkleIndex: encryptedNote.merkleIndex,
        };
      } else {
        // otherwise, it's not ours and it's not encrypted. compute and return the commitment
        const includedNote = note as IncludedNote;
        return NoteTrait.toIncludedCommitment(includedNote);
      }
    });

    return {
      notesAndCommitments,
      nullifiers,
      nextMerkleIndex,
      blockNumber,
    };
  }
}
