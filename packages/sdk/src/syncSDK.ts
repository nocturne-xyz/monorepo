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

export interface SyncDeps {
  viewer: NocturneViewer;
  provider: ethers.providers.Provider;
}

export async function syncSDK(
  { provider, viewer }: SyncDeps,
  adapter: SyncAdapter,
  db: NocturneDB,
  merkle: MerkleProver,
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
  }

  // update merkle tree to current
  if (!opts?.skipMerkleProverUpdates) {
    await updateMerkle(db, merkle);
  }
}

async function updateMerkle(
  db: NocturneDB,
  merkle: MerkleProver
): Promise<void> {
  while (true) {
    const start = await merkle.count();
    const end = start + MERKLE_MAX_CHUNK_SIZE;
    const newLeaves = await db.getNoteCommitmentsByIndexRange(start, end);

    if (newLeaves.length === 0) {
      return;
    }

    for (const { merkleIndex, noteCommitment } of newLeaves) {
      await merkle.insert(merkleIndex, noteCommitment);
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
