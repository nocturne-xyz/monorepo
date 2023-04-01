import { NocturneViewer } from "./crypto";
import { NocturneDB } from "./NocturneDB";
import {
  ClosableAsyncIterator,
  EncryptedStateDiff,
  StateDiff,
  SDKSyncAdapter,
} from "./sync";
import { ethers } from "ethers";
import { IncludedEncryptedNote, IncludedNote, IncludedNoteCommitment, NoteTrait } from "./primitives";
import { SparseMerkleProver } from "./SparseMerkleProver";

// TODO mess with these
const NOTES_MAX_CHUNK_SIZE = 10000;

export interface SyncOpts {
  // defaults to `false`.
  // If this is set to `true`, `sync` will only update the DB
  // and will not update the in-memory tree.
  skipMerkleProverUpdates: boolean;
}

export interface SyncDeps {
  viewer: NocturneViewer;
  provider: ethers.providers.Provider;
}

export async function syncSDK(
  { provider, viewer }: SyncDeps,
  adapter: SDKSyncAdapter,
  db: NocturneDB,
  merkle: SparseMerkleProver,
  opts?: SyncOpts
): Promise<void> {
  const nextBlockToSync = await db.nextBlock();
  const currentBlock = await provider.getBlockNumber();
  console.log(`Syncing from block ${nextBlockToSync} to ${currentBlock}...`);

  const newDiffs = adapter.iterStateDiffs(nextBlockToSync, {
    maxChunkSize: NOTES_MAX_CHUNK_SIZE,
    endBlock: currentBlock,
  });

  // decrypt notes and compute nullifiers
  const diffs: ClosableAsyncIterator<StateDiff> = newDiffs.map((diff) =>
    decryptStateDiff(viewer, diff)
  );

  // apply diffs
  for await (const diff of diffs.iter) {
    await db.applyStateDiff(diff);
    
    if (!opts?.skipMerkleProverUpdates) {
      for (const noteOrCommitment of diff.notesAndCommitments) {
        const isCommitment = NoteTrait.isCommitment(noteOrCommitment);
        const { merkleIndex, noteCommitment } = isCommitment ? noteOrCommitment as IncludedNoteCommitment : NoteTrait.toIncludedCommitment(noteOrCommitment as IncludedNote);

        // we only 'care' about notes that are ours, and we've reduced all notes that aren't ours to note commitments
        merkle.insert(merkleIndex, noteCommitment, !isCommitment);
      }
      await merkle.persist();
    }
  }
}

function decryptStateDiff(
  viewer: NocturneViewer,
  { notes, nullifiers, nextMerkleIndex, blockNumber }: EncryptedStateDiff
): StateDiff {
  const notesAndCommitments = notes.map((note) => {
    const isOwn = viewer.isOwnAddress(note.owner);
    const isEncrypted = NoteTrait.isEncryptedNote(note);

    if (isOwn && isEncrypted) {
      // if it's ours and its encrypted, decrypt it, get the nullifier, and return it
      const { merkleIndex, asset, ...encryptedNote } =
        note as IncludedEncryptedNote;
      const includedNote = viewer.getNoteFromEncryptedNote(
        encryptedNote,
        merkleIndex,
        asset
      );
      const nullifier = viewer.createNullifier(includedNote);
      return { ...includedNote, nullifier };
    } else if (isOwn && !isEncrypted) {
      // if it's ours and it's not encrypted, get the nullifier and return it
      const includedNote = note as IncludedNote;
      const nullifier = viewer.createNullifier(includedNote);
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
