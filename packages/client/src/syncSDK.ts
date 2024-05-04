import {
  EncryptedStateDiff,
  Histogram,
  IncludedEncryptedNote,
  IncludedNote,
  IncludedNoteCommitment,
  NoteTrait,
  SDKSyncAdapter,
  SparseMerkleProver,
  StateDiff,
  TotalEntityIndexTrait,
  consecutiveChunks,
  decryptNote,
  timed,
  timedAsync,
} from "@nocturne-xyz/core";
import { NocturneViewer } from "@nocturne-xyz/crypto";
import { NocturneDB } from "./NocturneDB";
import { NocturneEventBus } from "./events";

export interface SyncOpts {
  endBlock?: number;
  timeoutSeconds?: number;
  timing?: boolean;
  finalityBlocks?: number;
}

export interface SyncDeps {
  viewer: NocturneViewer;
  eventBus: NocturneEventBus;
}

// Sync SDK, returning last synced merkle index of last state diff
export async function syncSDK(
  { viewer, eventBus }: SyncDeps,
  adapter: SDKSyncAdapter,
  db: NocturneDB,
  merkle: SparseMerkleProver,
  opts?: SyncOpts
): Promise<number | undefined> {
  const currTotalEntityIndex = await db.currentTotalEntityIndex();
  const startTotalEntityIndex = currTotalEntityIndex
    ? currTotalEntityIndex + 1n
    : 0n;

  const currentBlock = await adapter.getLatestIndexedBlock();
  const endTotalEntityIndex = TotalEntityIndexTrait.fromBlockNumber(
    opts?.endBlock ?? currentBlock
  );

  const startMerkleIndex = (await db.latestSyncedMerkleIndex()) ?? 0;
  const endMerkleIndex =
    (await adapter.getLatestIndexedMerkleIndex(currentBlock + 1)) ?? 0;

  // skip syncing if we're already synced
  const latestCommittedMerkleIndex = await db.latestCommittedMerkleIndex();
  if (
    latestCommittedMerkleIndex !== undefined &&
    latestCommittedMerkleIndex === endMerkleIndex
  ) {
    eventBus.emit("SYNC_PROGRESS", 100);
    eventBus.emit("SYNC_COMPLETE", undefined);
    console.log("synced to latestCommittedMerkleIndex, returning early...");
    return latestCommittedMerkleIndex;
  }

  const range = {
    startTotalEntityIndex,
    endTotalEntityIndex,
    startBlock: TotalEntityIndexTrait.toComponents(startTotalEntityIndex)
      .blockNumber,
    endBlock: currentBlock,
  };
  console.log(
    `[syncSDK] syncing SDK from totalEntityIndex ${startTotalEntityIndex} (block ${range.startBlock}) to ${range.endBlock} (block ${currentBlock})...`,
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

  let latestSyncedMerkleIndex: number | undefined =
    await db.latestSyncedMerkleIndex();

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
    const [nfIndices, nfTime] = await timedAsync(() => db.applyStateDiff(diff));
    applyStateDiffHistogram?.sample(nfTime / diff.notesAndCommitments.length);
    latestSyncedMerkleIndex = await db.latestSyncedMerkleIndex();

    // TODO: deal with case where we have failure between applying state diff to DB and merkle being persisted

    if (diff.latestCommittedMerkleIndex) {
      const [_, time] = await timedAsync(() =>
        updateMerkle(
          merkle,
          diff.latestCommittedMerkleIndex!,
          diff.notesAndCommitments.map((n) => n.inner),
          nfIndices
        )
      );
      updateMerkleHistogram?.sample(time / diff.notesAndCommitments.length);
    }

    // TODO be a bit more intelligent about this
    eventBus.emit("STATE_DIFF", undefined);

    // note that we don't re-fetch endMerkleIndex anymore. While this leads to "weird" progress when the tree is tiny / growing quickly,
    // in practice neithes of those things are true
    const num = (latestSyncedMerkleIndex ?? 0) - startMerkleIndex;
    const denom = endMerkleIndex - startMerkleIndex;

    // rounding is fine here
    // HACK if endMerkleIndex - startMerkleIndex is 0, say we're done to avoid NaN progress
    eventBus.emit("SYNC_PROGRESS", denom === 0 ? 100 : 100 * (num / denom));
  }

  eventBus.emit("SYNC_PROGRESS", 100);
  eventBus.emit("SYNC_COMPLETE", undefined);

  diffHistogram?.print();
  applyStateDiffHistogram?.print();
  updateMerkleHistogram?.print();

  console.log("syncWithProgress returning...");
  return latestSyncedMerkleIndex;
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
    merkle.insertBatchUncommitted(startIndex, leaves, includes);
  }

  // commit up to latest subtree commit
  merkle.commitUpToIndex(latestCommittedMerkleIndex);

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
    latestCommittedMerkleIndex,
    latestCommitTei,
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
    latestCommitTei,
    latestNewlySyncedMerkleIndex,
    totalEntityIndex,
  };
}
