import {
  CompressedStealthAddress,
  NocturneViewer,
  StealthAddress,
  StealthAddressTrait,
} from "./crypto";
import { NocturneDB } from "./NocturneDB";
import {
  ClosableAsyncIterator,
  EncryptedStateDiff,
  StateDiff,
  SDKSyncAdapter,
  TotalEntityIndexTrait,
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
  const currTotalEntityIndex = await db.totalEntityIndex();
  const startTotalEntityIndex = currTotalEntityIndex
    ? currTotalEntityIndex + 1n
    : 0n;

  const currentBlock = await provider.getBlockNumber();
  const endTotalEntityIndex = TotalEntityIndexTrait.fromComponents({
    blockNumber: BigInt(currentBlock),
  });
  console.log(
    `syncing SDK from totalEntityIndex ${startTotalEntityIndex} (block ${
      TotalEntityIndexTrait.toComponents(startTotalEntityIndex).blockNumber
    }) to ${endTotalEntityIndex} (block ${currentBlock})...`
  );

  const newDiffs = adapter.iterStateDiffs(startTotalEntityIndex, {
    endTotalEntityIndex,
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
    console.log(
      "applied state diff up to totalEntityIndex",
      diff.totalEntityIndex
    );

    // TODO: deal with case where we have failure between applying state diff to DB and merkle being persisted

    if (diff.lastCommittedMerkleIndex) {
      await updateMerkle(
        merkle,
        diff.lastCommittedMerkleIndex,
        diff.notesAndCommitments.map(({ inner }) => inner),
        nfIndices
      );
    }
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
  console.log("committing up to index", latestCommittedMerkleIndex);
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
    totalEntityIndex,
  }: EncryptedStateDiff
): StateDiff {
  const notesAndCommitments = notes.map(({ inner, totalEntityIndex }) => {
    const note = inner;
    const isEncrypted = NoteTrait.isEncryptedNote(note);
    const owner = isEncrypted
      ? StealthAddressTrait.decompress(note.owner as CompressedStealthAddress)
      : (note.owner as StealthAddress);
    const isOwn = viewer.isOwnAddress(owner);

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
      const res = { ...includedNote, nullifier };
      return {
        inner: res,
        totalEntityIndex,
      };
    } else if (isOwn && !isEncrypted) {
      // if it's ours and it's not encrypted, get the nullifier and return it
      const includedNote = note as IncludedNote;
      const nullifier = viewer.createNullifier(includedNote);
      const res = { ...includedNote, nullifier };
      return {
        inner: res,
        totalEntityIndex,
      };
    } else if (!isOwn && isEncrypted) {
      // if it's not ours and it's encrypted, return the given commitment
      const encryptedNote = note as IncludedEncryptedNote;
      const nc = {
        noteCommitment: encryptedNote.commitment,
        merkleIndex: encryptedNote.merkleIndex,
      };

      return {
        inner: nc,
        totalEntityIndex,
      };
    } else {
      // otherwise, it's not ours and it's not encrypted. compute and return the commitment
      const includedNote = note as IncludedNote;
      const nc = NoteTrait.toIncludedCommitment(includedNote);
      return {
        inner: nc,
        totalEntityIndex,
      };
    }
  });

  return {
    notesAndCommitments,
    nullifiers,
    lastCommittedMerkleIndex,
    totalEntityIndex,
  };
}
