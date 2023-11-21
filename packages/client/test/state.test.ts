import "mocha";
import { expect } from "chai";
import {
  InMemoryKVStore,
  Asset,
  // IncludedNoteWithNullifier,
  // WithTotalEntityIndex,
  NocturneSigner,
  StateDiff,
  Nullifier,
  MerkleIndex,
  zip,
  NoteTrait,
} from "@nocturne-xyz/core";
import { NocturneClientState } from "../src/NocturneClientState";
import {
  DUMMY_ROOT_KEY,
  shitcoin,
  dummyNotesAndNfs as _dummyNotesAndNfs,
  dummyOp as _dummyOp,
  DummyNotesAndNfsOptions,
} from "./utils";

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
  // const dummyOp = (numJoinSplits: number, asset: Asset) =>
  //   _dummyOp(viewer, numJoinSplits, asset);

  // const toIncludedNote = ({ nullifier, ...rest }: IncludedNoteWithNullifier) =>
  //   rest;

  it("correctly applies state diff with only notes", () => {
    const [_, state] = newState();

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
    const [_, state] = newState();
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
    const [_, state] = newState();

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
      totalEntityIndex: 19n,
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
    expect(state.currentTei).to.equal(19n);
    // TODO: fix this once this is in state diff
    // expect(state.teiOfLatestCommit).to.be.undefined;
    expect(state.latestSyncedMerkleIndex).to.equal(9);
    expect(state.latestCommittedMerkleIndex).to.equal(9);
  });

  it("correctly applies state diff that only advances tree", () => {});

  it("correctly applies trivial state diff", () => {});

  it("gets all notes for a given asset", () => {});

  it("only returns committed notes without { includeUncommitted: true }", () => {});

  it("includes committed notes notes with { ignoreOptimisticNfs: true }", () => {});

  it("includes optimistically nf'd notes without { ignoreOptimisticNfs: true }", () => {});

  it("gets and sets op history", () => {});

  it("applies optimistic nullifiers when adding op to history", async () => {});
});

// function withDummyTotalEntityIndices<T>(arr: T[]): WithTotalEntityIndex<T>[] {
//   return arr.map((t) => ({ inner: t, totalEntityIndex: 0n }));
// }
