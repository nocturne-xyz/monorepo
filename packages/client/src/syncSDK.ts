import { NocturneViewer } from "@nocturne-xyz/crypto";
import {
  IncludedEncryptedNote,
  IncludedNote,
  IncludedNoteCommitment,
  NoteTrait,
  EncryptedStateDiff,
  StateDiff,
  SDKSyncAdapter,
  TotalEntityIndexTrait,
  decryptNote,
  SparseMerkleProver,
  consecutiveChunks,
  timed,
  Histogram,
} from "@nocturne-xyz/core";
import { NocturneClientState } from "./NocturneClientState";

export interface SyncOpts {
  endBlock?: number;
  timeoutSeconds?: number;
  timing?: boolean;
  finalityBlocks?: number;
}

export interface SyncDeps {
  viewer: NocturneViewer;
}

// Sync SDK, returning last synced merkle index of last state diff
export async function syncSDK(
  { viewer }: SyncDeps,
  adapter: SDKSyncAdapter,
  state: NocturneClientState,
  merkle: SparseMerkleProver,
  opts?: SyncOpts
): Promise<number | undefined> {
  const startTotalEntityIndex = state.currentTei 
    ? state.currentTei + 1n
    : 0n;

  const currentBlock = await adapter.getLatestIndexedBlock();
  const endTotalEntityIndex = TotalEntityIndexTrait.fromBlockNumber(
    opts?.endBlock ?? currentBlock
  );
  const range = {
    startTotalEntityIndex,
    endTotalEntityIndex,
    startBlock: TotalEntityIndexTrait.toComponents(startTotalEntityIndex)
      .blockNumber,
    endBlock: currentBlock,
  };
  console.log(
    `[syncSDK] syncing SDK from totalEntityIndex ${startTotalEntityIndex} (block ${range.startBlock}) to ${endTotalEntityIndex} (block ${currentBlock})...`,
    { range }
  );

  const newDiffs = adapter.iterStateDiffs(startTotalEntityIndex, {
    endTotalEntityIndex,
    timing: opts?.timing,
    finalityBlocks: opts?.finalityBlocks,
  });

  // decrypt notes and compute nullifiers
  const diffHistogram = opts?.timing
    ? new Histogram("decryptStateDiff time (ms) per note")
    : undefined;
  const diffs = newDiffs.map((diff) => {
    const [decrypted, time] = timed(() => decryptStateDiff(viewer, diff));
    diffHistogram?.sample(time / diff.notes.length);
    return decrypted;
  });

  let latestSyncedMerkleIndex = state.latestSyncedMerkleIndex;

  if (opts?.timeoutSeconds) {
    setTimeout(() => diffs.close(), opts.timeoutSeconds * 1000);
  }

  // apply diffs
  const applyStateDiffHistogram = opts?.timing
    ? new Histogram("applyStateDiff time (ms) per note or commitment")
    : undefined;
  const updateMerkleHistogram = opts?.timing
    ? new Histogram("updateMerkle time (ms) per note or commitment")
    : undefined;
  for await (const diff of diffs.iter) {
    console.log(
      "[syncSDK] diff latestNewlySyncedMerkleIndex",
      diff.latestNewlySyncedMerkleIndex
    );
    // update notes in DB
    const [nfIndices, nfTime] = timed(() => state.applyStateDiff(diff));
    applyStateDiffHistogram?.sample(nfTime / diff.notesAndCommitments.length);
    latestSyncedMerkleIndex = state.latestSyncedMerkleIndex;

    if (diff.latestCommittedMerkleIndex) {
      const [_, time] = timed(() =>
        updateMerkle(
          merkle,
          diff.latestCommittedMerkleIndex!,
          diff.notesAndCommitments.map((n) => n.inner),
          nfIndices
        )
      );
      updateMerkleHistogram?.sample(time / diff.notesAndCommitments.length);
    }
  }

  // TODO instead of snapshotting at the end, check tree root every K diffs and snapshot if it's correct
  await state.save();

  diffHistogram?.print();
  applyStateDiffHistogram?.print();
  updateMerkleHistogram?.print();

  return latestSyncedMerkleIndex;
}

function updateMerkle(
  merkle: SparseMerkleProver,
  latestCommittedMerkleIndex: number,
  notesAndCommitments: (IncludedNote | IncludedNoteCommitment)[],
  nfIndices: number[]
): void {
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
    merkle.insertBatchUncommitted(startIndex, leaves, includes);
  }

  // commit up to latest subtree commit
  merkle.commitUpToIndex(latestCommittedMerkleIndex);

  // mark nullified ones for pruning
  for (const index of nfIndices) {
    merkle.markForPruning(index);
  }
}

function decryptStateDiff(
  viewer: NocturneViewer,
  {
    notes,
    nullifiers,
    latestCommittedMerkleIndex,
    latestNewlySyncedMerkleIndex,
    totalEntityIndex,
  }: EncryptedStateDiff
): StateDiff {
  const notesAndCommitments = notes.map(({ inner, totalEntityIndex }) => {
    const note = inner;
    const isEncrypted = NoteTrait.isEncryptedNote(note);
    if (isEncrypted) {
      // if it's encrypted, attempt to decrypt.
      // if it succeeds, then return the decrypted note
      // if it fails, assume it's not ours and just the commitment and merkle index
      try {
        const { merkleIndex, commitment, ...encryptedNote } =
          note as IncludedEncryptedNote;

        // TODO: come up with a way to handle sender mismatches when we implement history proofs
        const includedNote: IncludedNote = {
          ...decryptNote(viewer, encryptedNote),
          merkleIndex,
        };
        const nullifier = NoteTrait.createNullifier(viewer, includedNote);
        const res = { ...includedNote, nullifier };
        return {
          inner: res,
          totalEntityIndex,
        };
      } catch (err) {
        const encryptedNote = note as IncludedEncryptedNote;
        const { commitment, merkleIndex } = encryptedNote;
        const nc = {
          noteCommitment: commitment,
          merkleIndex,
        };

        return {
          inner: nc,
          totalEntityIndex,
        };
      }
    } else {
      // if it's not encrypted, check if it's ours.
      // if it is, then return it
      // if it's not, return only the commitment
      const includedNote = note as IncludedNote;
      const isOwn = viewer.isOwnAddress(includedNote.owner);

      if (isOwn) {
        const nullifier = NoteTrait.createNullifier(viewer, includedNote);
        const res = { ...includedNote, nullifier };
        return {
          inner: res,
          totalEntityIndex,
        };
      } else {
        const nc = {
          noteCommitment: NoteTrait.toCommitment(includedNote),
          merkleIndex: includedNote.merkleIndex,
        };
        return {
          inner: nc,
          totalEntityIndex,
        };
      }
    }
  });

  return {
    notesAndCommitments,
    nullifiers,
    latestCommittedMerkleIndex,
    latestNewlySyncedMerkleIndex,
    totalEntityIndex,
  };
}
