import { NocturneViewer } from "./crypto";
import { NocturneDB } from "./NocturneDB";
import {
  ClosableAsyncIterator,
  EncryptedStateDiff,
  StateDiff,
  SDKSyncAdapter,
  TotalEntityIndexTrait,
} from "./sync";
import {
  IncludedEncryptedNote,
  IncludedNote,
  IncludedNoteCommitment,
  NoteTrait,
} from "./primitives";
import { SparseMerkleProver } from "./SparseMerkleProver";
import { consecutiveChunks } from "./utils/functional";

export interface SyncOpts {
  endBlock?: number;
}

export interface SyncDeps {
  viewer: NocturneViewer;
}

export async function syncSDK(
  { viewer }: SyncDeps,
  adapter: SDKSyncAdapter,
  db: NocturneDB,
  merkle: SparseMerkleProver,
  opts?: SyncOpts
): Promise<void> {
  const currTotalEntityIndex = await db.currentTotalEntityIndex();
  const startTotalEntityIndex = currTotalEntityIndex
    ? currTotalEntityIndex + 1n
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
  });

  // decrypt notes and compute nullifiers
  const diffs: ClosableAsyncIterator<StateDiff> = newDiffs.map((diff) =>
    decryptStateDiff(viewer, diff)
  );

  // apply diffs
  for await (const diff of diffs.iter) {
    // update notes in DB
    const nfIndices = await db.applyStateDiff(diff);

    // TODO: deal with case where we have failure between applying state diff to DB and merkle being persisted

    if (diff.lastCommittedMerkleIndex) {
      await updateMerkle(
        merkle,
        diff.lastCommittedMerkleIndex,
        diff.notesAndCommitments.map((n) => n.inner),
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
    lastCommittedMerkleIndex,
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
        const [includedNote] = viewer.decryptNote(encryptedNote, merkleIndex);
        const nullifier = viewer.createNullifier(includedNote);
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
        const nullifier = viewer.createNullifier(includedNote);
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
    lastCommittedMerkleIndex,
    totalEntityIndex,
  };
}
