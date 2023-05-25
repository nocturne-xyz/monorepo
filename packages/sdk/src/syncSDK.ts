import { NocturneViewer } from "./crypto";
import { NocturneDB } from "./NocturneDB";
import {
  ClosableAsyncIterator,
  EncryptedStateDiff,
  StateDiff,
  SDKSyncAdapter,
} from "./sync";
import { ethers } from "ethers";
import {
  IncludedEncryptedNote,
  IncludedNote,
  IncludedNoteCommitment,
  NoteTrait,
} from "./primitives";
import { SparseMerkleProver } from "./SparseMerkleProver";
import { consecutiveChunks } from "./utils/functional";

// TODO mess with these
const NOTES_MAX_CHUNK_SIZE = 10000;
const DEFAULT_THROTTLE_MS = 2000;

export interface SyncOpts {
  startBlock: number;
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
  const nextBlockToSync = (await db.nextBlock()) ?? opts?.startBlock ?? 0;
  const currentBlock = await provider.getBlockNumber();
  console.log(
    `syncing SDK from block ${nextBlockToSync} to ${currentBlock}...`
  );

  const newDiffs = adapter.iterStateDiffs(nextBlockToSync, {
    maxChunkSize: NOTES_MAX_CHUNK_SIZE,
    endBlock: currentBlock,
    throttleMs: DEFAULT_THROTTLE_MS,
  });

  // decrypt notes and compute nullifiers
  const diffs: ClosableAsyncIterator<StateDiff> = newDiffs.map((diff) =>
    decryptStateDiff(viewer, diff)
  );

  // apply diffs
  for await (const diff of diffs.iter) {
    // update notes in DB
    const nfIndices = await db.applyStateDiff(diff);
    console.log("applied state diff for block", diff.blockNumber);

    // TODO: deal with case where we have failure between applying state diff to DB and merkle being persisted
    await updateMerkle(
      merkle,
      diff.lastCommittedMerkleIndex,
      diff.notesAndCommitments,
      nfIndices
    );
  }
}

async function updateMerkle(
  merkle: SparseMerkleProver,
  latestCommittedMerkleIndex: number,
  notesAndCommitments: (IncludedNote | IncludedNoteCommitment)[],
  nfIndices: number[]
): Promise<void> {
  // add all new leaves as uncommitted leaves
  const batches = consecutiveChunks(
    notesAndCommitments,
    (noteOrCommitment) => noteOrCommitment.merkleIndex
  );
  for (const batch of batches) {
    const startIndex = batch[0].merkleIndex;
    const leaves = [];
    const includes = [];
    for (const noteOrCommitment of batch) {
      if (NoteTrait.isCommitment(noteOrCommitment)) {
        leaves.push(
          (noteOrCommitment as IncludedNoteCommitment).noteCommitment
        );
        includes.push(false);
      } else {
        leaves.push(NoteTrait.toCommitment(noteOrCommitment as IncludedNote));
        includes.push(true);
      }
    }
    console.log("[syncSdk] got batch", batch);
    merkle.insertBatchUncommitted(startIndex, leaves, includes);
  }

  // commit up to latest subtree commit
  merkle.commitUpToIndex(latestCommittedMerkleIndex);

  console.log("merkle root:", merkle.getRoot());

  // mark nullified ones for pruning
  for (const index of nfIndices) {
    merkle.markForPruning(index);
  }

  // persist merkle to underlying KV store
  await merkle.persist();
}

function decryptStateDiff(
  viewer: NocturneViewer,
  {
    notes,
    nullifiers,
    lastCommittedMerkleIndex,
    blockNumber,
  }: EncryptedStateDiff
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
    lastCommittedMerkleIndex,
    blockNumber,
  };
}
