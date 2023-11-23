import "mocha";
import { expect } from "chai";
import {
  InMemoryKVStore,
  Asset,
  NocturneSigner,
  StateDiff,
  Nullifier,
  MerkleIndex,
  zip,
  NoteTrait,
  OperationStatus,
  OperationTrait,
} from "@nocturne-xyz/core";
import { NocturneClientState } from "../src/NocturneClientState";
import {
  DUMMY_ROOT_KEY,
  shitcoin,
  dummyNotesAndNfs as _dummyNotesAndNfs,
  dummyOp as _dummyOp,
  DummyNotesAndNfsOptions,
  stablescam,
  ponzi,
  getNotesAndNfsFromOp,
} from "./utils";
import { OperationMetadata } from "../src";
import { __private } from "../src/NocturneClientState";

describe("NocturneClientState", async () => {
  const viewer = new NocturneSigner(DUMMY_ROOT_KEY).viewer();

  const newState = () => {
    const kv = new InMemoryKVStore();
    return [kv, new NocturneClientState(kv)] as const;
  };

  const dummyNotesAndNfs = (
    notesPerAsset: number,
    assets: Asset[],
    options?: DummyNotesAndNfsOptions
  ) => _dummyNotesAndNfs(viewer, notesPerAsset, assets, options);
  const dummyOp = (numJoinSplits: number, asset: Asset) =>
    _dummyOp(viewer, numJoinSplits, asset);

  it("correctly applies state diff with only notes", () => {
    const [, state] = newState();

    // apply state diff wth 10 new notes of the same asset
    const diff: StateDiff = {
      notesAndCommitments: dummyNotesAndNfs(10, [shitcoin])[0].map(
        (inner, i) => ({ inner, totalEntityIndex: BigInt(i) })
      ),
      nullifiers: [],
      totalEntityIndex: 9n,
      latestNewlySyncedMerkleIndex: 9,
      latestCommittedMerkleIndex: undefined,
    };
    state.applyStateDiff(diff);

    // notes should be in db
    const allNotes = [
      ...state.getAllNotes({ includeUncommitted: true }).values(),
    ].flat();
    expect(allNotes.length).to.eql(10);

    // each note should have an nf mapping in db, and each nf mapping in db should have 1 note
    const allNfMappings: [Nullifier, MerkleIndex][] = [
      ...state.__nfToMerkleIndex.entries(),
    ].map(([nf, i]) => [BigInt(nf), i]);
    const noteIndices = new Set(allNotes.map((n) => n.merkleIndex));
    const nfIndices = new Set(allNfMappings.map(([_, i]) => i));
    noteIndices.forEach((i) => expect(nfIndices.has(i)).to.be.true);
    nfIndices.forEach((i) => expect(noteIndices.has(i)).to.be.true);

    // nf mappings should be correct
    for (const [note, [nf, nfIndex]] of zip(
      allNotes.sort((a, b) => a.merkleIndex - b.merkleIndex),
      allNfMappings.sort((a, b) => a[1] - b[1])
    )) {
      expect(nf).to.eql(NoteTrait.createNullifier(viewer, note));
      expect(nfIndex).to.eql(note.merkleIndex);
    }

    // teis and merkle indices should be correct
    expect(state.currentTei).to.equal(9n);
    // TODO: fix this once this is in state diff
    // expect(state.teiOfLatestCommit).to.be.undefined;
    expect(state.latestSyncedMerkleIndex).to.equal(9);
    expect(state.latestCommittedMerkleIndex).to.be.undefined;
  });

  it("correctly applies state diff with only note commitments", () => {
    const [, state] = newState();
    // apply state diff wth 10 new notes of the same asset
    const diff: StateDiff = {
      notesAndCommitments: dummyNotesAndNfs(10, [shitcoin])[0]
        .map(NoteTrait.toIncludedCommitment)
        .map((inner, i) => ({ inner, totalEntityIndex: BigInt(i) })),
      nullifiers: [],
      totalEntityIndex: 9n,
      latestNewlySyncedMerkleIndex: 9,
      latestCommittedMerkleIndex: undefined,
    };
    state.applyStateDiff(diff);

    // there should be no notes in db
    const allNotes = [
      ...state.getAllNotes({ includeUncommitted: true }).values(),
    ].flat();
    expect(allNotes.length).to.eql(0);

    // there should be no nf mappings in db
    const allNfMappings: [Nullifier, MerkleIndex][] = [
      ...state.__nfToMerkleIndex.entries(),
    ].map(([nf, i]) => [BigInt(nf), i]);
    expect(allNfMappings.length).to.eql(0);

    // teis and merkle indices should be correct
    expect(state.currentTei).to.equal(9n);
    // TODO: fix this once this is in state diff
    // expect(state.teiOfLatestCommit).to.be.undefined;
    expect(state.latestSyncedMerkleIndex).to.equal(9);
    expect(state.latestCommittedMerkleIndex).to.be.undefined;
  });

  it("correctly applies state diff with nullifiers", () => {
    const [, state] = newState();

    // get 10 new notes and nfs - first apply a state diff with the notes, then apply a state diff with the nfs
    const [notes, nfs] = dummyNotesAndNfs(10, [shitcoin]);
    const diff1: StateDiff = {
      notesAndCommitments: notes.map((inner, i) => ({
        inner,
        totalEntityIndex: BigInt(i),
      })),
      nullifiers: [],
      totalEntityIndex: 9n,
      latestNewlySyncedMerkleIndex: 9,
      latestCommittedMerkleIndex: 9,
    };
    state.applyStateDiff(diff1);

    const diff2: StateDiff = {
      notesAndCommitments: [],
      nullifiers: nfs,
      // 1 entity for the subtree commit, 10 for the notes
      totalEntityIndex: 20n,
      latestNewlySyncedMerkleIndex: undefined,
      latestCommittedMerkleIndex: 9,
    };
    state.applyStateDiff(diff2);

    // there should be no notes in db
    const allNotes = [
      ...state.getAllNotes({ includeUncommitted: true }).values(),
    ].flat();
    expect(allNotes.length).to.eql(0);

    // there should be no nf mappings in db
    const allNfMappings: [Nullifier, MerkleIndex][] = [
      ...state.__nfToMerkleIndex.entries(),
    ].map(([nf, i]) => [BigInt(nf), i]);
    expect(allNfMappings.length).to.eql(0);

    // teis and merkle indices should be correct
    expect(state.currentTei).to.equal(20n);
    // TODO: fix this once this is in state diff
    // expect(state.teiOfLatestCommit).to.be.undefined;
    expect(state.latestSyncedMerkleIndex).to.equal(9);
    expect(state.latestCommittedMerkleIndex).to.equal(9);
  });

  it("correctly applies state diff that only advances tree", () => {
    const [, state] = newState();

    // get 10 new notes and nfs - first apply a state diff with the notes, then apply a state diff with the nfs
    const [notes] = dummyNotesAndNfs(10, [shitcoin]);
    const diff1: StateDiff = {
      notesAndCommitments: notes.map((inner, i) => ({
        inner,
        totalEntityIndex: BigInt(i),
      })),
      nullifiers: [],
      totalEntityIndex: 9n,
      latestNewlySyncedMerkleIndex: 9,
      latestCommittedMerkleIndex: 9,
    };
    state.applyStateDiff(diff1);

    const diff2: StateDiff = {
      notesAndCommitments: [],
      nullifiers: [],
      totalEntityIndex: 10n,
      latestNewlySyncedMerkleIndex: undefined,
      latestCommittedMerkleIndex: 9,
    };
    state.applyStateDiff(diff2);

    // notes should still be in db
    const allNotes = [
      ...state.getAllNotes({ includeUncommitted: true }).values(),
    ].flat();
    expect(allNotes.length).to.eql(10);

    // notes should now be returned when `includeUncomitted` is set to `false`
    const allNotes2 = [...state.getAllNotes().values()].flat();
    expect(allNotes2.length).to.eql(10);

    // teis and merkle indices should be correct
    expect(state.currentTei).to.equal(10n);
    // TODO: fix this once this is in state diff
    // expect(state.teiOfLatestCommit).to.be.undefined;
    expect(state.latestSyncedMerkleIndex).to.equal(9);
    expect(state.latestCommittedMerkleIndex).to.equal(9);
  });

  it("apply state diff is idempotent", () => {
    const [, state] = newState();

    // get 10 new notes and nfs - first apply a state diff with the notes, then apply a state diff with the nfs
    const [notes, nfs] = dummyNotesAndNfs(10, [shitcoin]);
    const diff: StateDiff = {
      notesAndCommitments: notes.map((inner, i) => ({
        inner,
        totalEntityIndex: BigInt(i),
      })),
      nullifiers: [],
      totalEntityIndex: 9n,
      latestNewlySyncedMerkleIndex: 9,
      latestCommittedMerkleIndex: undefined,
    };
    state.applyStateDiff(diff);

    const [notes2] = dummyNotesAndNfs(10, [stablescam]);
    const diff2: StateDiff = {
      notesAndCommitments: notes2.map(({ merkleIndex, ...rest }, i) => ({
        inner: { merkleIndex: merkleIndex + 10, ...rest },
        totalEntityIndex: BigInt(i),
      })),
      nullifiers: nfs.slice(0, 6),
      // 1 for commit, 6 for nfs, 10 for notes
      totalEntityIndex: 26n,
      latestNewlySyncedMerkleIndex: 19,
      latestCommittedMerkleIndex: 9,
    };

    state.applyStateDiff(diff2);

    const currentTeiBefore = state.currentTei;
    const commitTeiBefore = state.teiOfLatestCommit;
    const merkleIndexBefore = state.latestSyncedMerkleIndex;
    const commitIndexBefore = state.latestCommittedMerkleIndex;

    const merkleRootBefore = state.merkleRoot;

    const noteMapBefore = state.__merkleIndexToNote;
    const teiMapBefore = state.__merkleIndexToTei;
    const assetMapBefore = state.__assetToMerkleIndices;
    const nfMapBefore = state.__nfToMerkleIndex;

    // apply diff again
    state.applyStateDiff(diff2);

    // teis and merkle indices should be the same
    expect(state.currentTei).to.equal(currentTeiBefore);
    expect(state.teiOfLatestCommit).to.equal(commitTeiBefore);
    expect(state.latestSyncedMerkleIndex).to.equal(merkleIndexBefore);
    expect(state.latestCommittedMerkleIndex).to.equal(commitIndexBefore);

    // merkle root should be the same
    expect(state.merkleRoot).to.equal(merkleRootBefore);

    // maps should be the same
    expect(state.__merkleIndexToNote).to.eql(noteMapBefore);
    expect(state.__merkleIndexToTei).to.eql(teiMapBefore);
    expect(state.__assetToMerkleIndices).to.eql(assetMapBefore);
    expect(state.__nfToMerkleIndex).to.eql(nfMapBefore);
  });

  it("gets all notes for a given asset", () => {
    const [, state] = newState();

    // get 10 new notes and nfs - first apply a state diff with the notes, then apply a state diff with the nfs
    const [notes] = dummyNotesAndNfs(10, [shitcoin, stablescam]);
    const diff: StateDiff = {
      notesAndCommitments: notes.map(({ merkleIndex, ...rest }, i) => ({
        inner: { merkleIndex: i, ...rest },
        totalEntityIndex: BigInt(i),
      })),
      nullifiers: [],
      totalEntityIndex: 19n,
      latestNewlySyncedMerkleIndex: 19,
      latestCommittedMerkleIndex: undefined,
    };
    state.applyStateDiff(diff);

    // get notes for shitcoin only
    // expect them to be the same
    const foundNotes = state
      .getNotesForAsset(shitcoin.assetAddr, { includeUncommitted: true })
      .sort((a, b) => a.merkleIndex - b.merkleIndex);
    const expectedNotes = notes
      .filter((n) => n.asset.assetAddr === shitcoin.assetAddr)
      .sort((a, b) => a.merkleIndex - b.merkleIndex);
    expect(foundNotes.length).to.eql(10);
    expect(expectedNotes).to.eql(foundNotes);
  });

  it("excludes uncommitted notes without { includeUncommitted: true }", () => {
    const [, state] = newState();

    // apply a diff with 10 new notes
    const [notes] = dummyNotesAndNfs(10, [shitcoin]);
    const diff: StateDiff = {
      notesAndCommitments: notes.map((inner, i) => ({
        inner,
        totalEntityIndex: BigInt(i),
      })),
      nullifiers: [],
      totalEntityIndex: 9n,
      latestNewlySyncedMerkleIndex: 9,
      latestCommittedMerkleIndex: undefined,
    };
    state.applyStateDiff(diff);

    // apply a diff that commits the first 4 notes
    const diff2: StateDiff = {
      notesAndCommitments: [],
      nullifiers: [],
      totalEntityIndex: 10n,
      latestNewlySyncedMerkleIndex: 9,
      latestCommittedMerkleIndex: 3,
    };
    state.applyStateDiff(diff2);

    // get notes for shitcoin without setting `includeUncommitted`
    // expect to only have 4
    expect(state.getNotesForAsset(shitcoin.assetAddr).length).to.eql(4);
  });

  it("includes uncommitted notes notes with { includeUncommitted: true }", () => {
    const [, state] = newState();

    // apply a diff with 10 new notes
    const [notes] = dummyNotesAndNfs(10, [shitcoin]);
    const diff: StateDiff = {
      notesAndCommitments: notes.map((inner, i) => ({
        inner,
        totalEntityIndex: BigInt(i),
      })),
      nullifiers: [],
      totalEntityIndex: 9n,
      latestNewlySyncedMerkleIndex: 9,
      latestCommittedMerkleIndex: undefined,
    };
    state.applyStateDiff(diff);

    // get notes for shitcoin while setting `includeUncommitted` to `true
    // expect there to be 10 of them
    expect(
      state.getNotesForAsset(shitcoin.assetAddr, { includeUncommitted: true })
        .length
    ).to.eql(10);
  });

  it("excludes optimistically nf'd notes without { ignoreOptimisticNfs: true }", () => {
    const [, state] = newState();

    // apply a diff with 10 new notes
    const [notes] = dummyNotesAndNfs(10, [shitcoin]);
    const diff: StateDiff = {
      notesAndCommitments: notes.map((inner, i) => ({
        inner,
        totalEntityIndex: BigInt(i),
      })),
      nullifiers: [],
      totalEntityIndex: 10n,
      latestNewlySyncedMerkleIndex: 9,
      latestCommittedMerkleIndex: 9,
    };
    state.applyStateDiff(diff);

    // add an optimistic nf for the 3rd note
    state.__optimisticNfs.set(2, Date.now() + 10000);

    // get notes for shitcoin without setting `ignoreOpitimisticNfs`
    const foundNotes = state.getNotesForAsset(shitcoin.assetAddr);
    // expect there to still be 9 of them and expect the missing one to be the 3rd one
    expect(foundNotes.length).to.eql(9);
    expect(foundNotes.map((n) => n.merkleIndex)).to.not.include(2);
  });

  it("includes optimistically nf'd notes with { ignoreOptimisticNfs: true }", () => {
    const [, state] = newState();

    // apply a diff with 10 new notes
    const [notes] = dummyNotesAndNfs(10, [shitcoin]);
    const diff: StateDiff = {
      notesAndCommitments: notes.map((inner, i) => ({
        inner,
        totalEntityIndex: BigInt(i),
      })),
      nullifiers: [],
      totalEntityIndex: 10n,
      latestNewlySyncedMerkleIndex: 9,
      latestCommittedMerkleIndex: 9,
    };
    state.applyStateDiff(diff);

    // add an optimistic nf for the 3rd note
    state.__optimisticNfs.set(2, Date.now() + 10000);

    // get notes for shitcoin while setting `ignoreOptimisticNfs` to `true
    // expect there to still be 10 of them
    expect(
      state.getNotesForAsset(shitcoin.assetAddr, { ignoreOptimisticNfs: true })
        .length
    ).to.eql(10);
  });

  it("gets and sets op history", () => {
    const [, state] = newState();

    // add a few ops with different assets
    const ops = [
      dummyOp(1, shitcoin),
      dummyOp(2, ponzi),
      dummyOp(3, stablescam),
    ];

    const metas: OperationMetadata[] = [
      {
        items: [
          {
            type: "Action",
            actionType: "Transfer",
            recipientAddress: "alpha",
            erc20Address: "bravo",
            amount: 1n,
          },
        ],
      },
      {
        items: [
          {
            type: "Action",
            actionType: "Transfer",
            recipientAddress: "bravo",
            erc20Address: "charlie",
            amount: 2n,
          },
        ],
      },
      {
        items: [
          {
            type: "Action",
            actionType: "Transfer",
            recipientAddress: "charlie",
            erc20Address: "delta",
            amount: 2n,
          },
        ],
      },
    ];

    state.addOpToHistory(ops[0], metas[0], OperationStatus.BUNDLE_REVERTED);
    state.addOpToHistory(ops[1], metas[1], OperationStatus.EXECUTED_SUCCESS);
    state.addOpToHistory(ops[2], metas[2]);

    // get op history, expect it to only have first 2
    expect(state.previousOps.length).to.eql(2);
    expect(state.previousOps[0].digest).to.eql(
      OperationTrait.computeDigest(ops[0])
    );
    expect(state.previousOps[1].digest).to.eql(
      OperationTrait.computeDigest(ops[1])
    );
    expect(state.previousOps[0].metadata).to.eql(metas[0]);
    expect(state.previousOps[1].metadata).to.eql(metas[1]);

    // get pending ops, expect it to only have third
    expect(state.pendingOps.length).to.eql(1);
    expect(state.pendingOps[0].digest).to.eql(
      OperationTrait.computeDigest(ops[2])
    );
    expect(state.pendingOps[0].metadata).to.eql(metas[2]);

    // get all ops
    expect(state.opHistory.length).to.eql(3);

    // check that the op digests match
    expect(state.opHistory[0].digest).to.eql(
      OperationTrait.computeDigest(ops[0])
    );
    expect(state.opHistory[1].digest).to.eql(
      OperationTrait.computeDigest(ops[1])
    );
    expect(state.opHistory[2].digest).to.eql(
      OperationTrait.computeDigest(ops[2])
    );

    // check that metadatas match
    expect(state.opHistory[0].metadata).to.eql(metas[0]);
    expect(state.opHistory[1].metadata).to.eql(metas[1]);
    expect(state.opHistory[2].metadata).to.eql(metas[2]);

    // check statuses match
    expect(state.opHistory[0].status).to.eql(OperationStatus.BUNDLE_REVERTED);
    expect(state.opHistory[1].status).to.eql(OperationStatus.EXECUTED_SUCCESS);
    expect(state.opHistory[2].status).to.be.undefined;
  });

  it("applies optimistic nullifiers when adding op to history", async () => {
    const [, state] = newState();

    // add an op with 5 joinsplits to history
    const op = dummyOp(5, shitcoin);
    const { oldNotes } = getNotesAndNfsFromOp(op);

    const diff: StateDiff = {
      notesAndCommitments: oldNotes.map((inner, i) => ({
        inner,
        totalEntityIndex: BigInt(i),
      })),
      nullifiers: [],
      totalEntityIndex: 10n,
      latestNewlySyncedMerkleIndex: 9,
      latestCommittedMerkleIndex: 9,
    };
    state.applyStateDiff(diff);
    state.addOpToHistory(op, { items: [] });

    // expect `getAllNotes` to return an empty map, as all notes have been optimistically nf'd
    expect([...state.getAllNotes().values()].flat()).to.be.empty;
  });

  it("makes snapshots", async () => {
    const [kv, state] = newState();

    // apply a diff with 10 new notes
    const [notes] = dummyNotesAndNfs(10, [shitcoin]);
    const diff: StateDiff = {
      notesAndCommitments: notes.map((inner, i) => ({
        inner,
        totalEntityIndex: BigInt(i),
      })),
      nullifiers: [],
      totalEntityIndex: 10n,
      latestNewlySyncedMerkleIndex: 9,
      latestCommittedMerkleIndex: 9,
    };
    state.applyStateDiff(diff);

    await state.save();

    expect(await kv.getString(__private.snapshotKey(10n))).to.not.be.undefined;

    // TODO: change these test cases when we have commit TEI in state diff
    const loadedState = await NocturneClientState.load(kv);
    expect(loadedState.currentTei).to.equal(state.currentTei);
    expect(loadedState.teiOfLatestCommit).to.equal(state.teiOfLatestCommit);
    expect(loadedState.latestSyncedMerkleIndex).to.equal(
      state.latestSyncedMerkleIndex
    );
    expect(loadedState.latestCommittedMerkleIndex).to.equal(
      state.latestCommittedMerkleIndex
    );
    expect(loadedState.merkleRoot).to.equal(state.merkleRoot);
    expect(loadedState.__merkleIndexToNote).to.eql(state.__merkleIndexToNote);
    expect(loadedState.__merkleIndexToTei).to.eql(state.__merkleIndexToTei);
    expect(loadedState.__assetToMerkleIndices).to.eql(
      state.__assetToMerkleIndices
    );
  });

  // TODO add more test cases when we have commit TEI in state diff
  // TODO add more test cases with dummy adapter when we have event-driven client
});
