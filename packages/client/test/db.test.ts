import "mocha";
import { expect } from "chai";
import {
  InMemoryKVStore,
  Asset,
  IncludedNoteWithNullifier,
  AssetTrait,
  WithTotalEntityIndex,
  NocturneSigner,
  OperationStatus,
  OperationTrait,
} from "@nocturne-xyz/core";
import { NocturneDB } from "../src/NocturneDB";
import {
  DUMMY_ROOT_KEY,
  ponzi,
  shitcoin,
  stablescam,
  dummyNotesAndNfs as _dummyNotesAndNfs,
  dummyOp as _dummyOp,
  getNotesAndNfsFromOp,
} from "./utils";
import { OperationMetadata } from "../src";

describe("NocturneDB", async () => {
  const kv = new InMemoryKVStore();
  const db = new NocturneDB(kv);
  const viewer = new NocturneSigner(DUMMY_ROOT_KEY).viewer();

  const dummyNotesAndNfs = (notesPerAsset: number, ...assets: Asset[]) =>
    _dummyNotesAndNfs(viewer, notesPerAsset, ...assets);
  const dummyOp = (numJoinSplits: number, asset: Asset) =>
    _dummyOp(viewer, numJoinSplits, asset);

  const toIncludedNote = ({ nullifier, ...rest }: IncludedNoteWithNullifier) =>
    rest;

  afterEach(async () => {
    await db.kv.clear();
  });

  after(async () => {
    await db.kv.close();
  });

  it("stores a batch of notes with a single asset", async () => {
    const [notes, _] = dummyNotesAndNfs(20, shitcoin);
    await db.storeNotes(withDummyTotalEntityIndices(notes));

    const map = await db.getAllNotes({
      includeUncommitted: true,
      ignoreOptimisticNFs: true,
    });
    const assetKey = NocturneDB.formatAssetKey(shitcoin);
    const shitcoinNotes = map.get(assetKey)!;
    const shitcoinNotesExpected = notes.map(toIncludedNote);
    expect(shitcoinNotes).to.not.be.undefined;
    expect(shitcoinNotes).to.eql(shitcoinNotesExpected);
  });

  it("stores a batch of notes with multiple assets", async () => {
    const [notes, _] = dummyNotesAndNfs(20, shitcoin, ponzi, stablescam);
    await db.storeNotes(withDummyTotalEntityIndices(notes));

    const map = await db.getAllNotes({
      includeUncommitted: true,
      ignoreOptimisticNFs: true,
    });

    for (const asset of [shitcoin, ponzi, stablescam]) {
      const assetKey = NocturneDB.formatAssetKey(asset);
      const assetHash = AssetTrait.hash(asset);
      const assetNotesExpected = notes
        .filter((n) => AssetTrait.hash(n.asset) === assetHash)
        .map(toIncludedNote);
      const assetNotesGot = map.get(assetKey)!;
      expect(assetNotesGot).to.not.be.undefined;
      expect(assetNotesGot).to.have.deep.members(assetNotesExpected);
    }
  });

  it("nullifies one note", async () => {
    const [notes, _] = dummyNotesAndNfs(20, shitcoin);
    await db.storeNotes(withDummyTotalEntityIndices(notes));

    const noteToNullify = notes[0];
    const nfToApply = noteToNullify.nullifier;

    await db.nullifyNotes([nfToApply]);
    const map = await db.getAllNotes({
      includeUncommitted: true,
      ignoreOptimisticNFs: true,
    });

    const shitcoinKey = NocturneDB.formatAssetKey(shitcoin);
    const shitcoinNotes = map.get(shitcoinKey);
    expect(shitcoinNotes).to.not.be.undefined;
    expect(shitcoinNotes!.length).to.equal(notes.length - 1);
    expect(shitcoinNotes!).to.not.deep.include(toIncludedNote(noteToNullify));
  });

  it("nullifies multiple notes", async () => {
    const [notes, _] = dummyNotesAndNfs(20, shitcoin);
    await db.storeNotes(withDummyTotalEntityIndices(notes));

    // remove the first 10 notes
    const notesToNullify = notes.slice(10);
    const nfsToApply = notesToNullify.map((n) => n.nullifier);

    await db.nullifyNotes(nfsToApply);
    const map = await db.getAllNotes({
      includeUncommitted: true,
      ignoreOptimisticNFs: true,
    });

    const shitcoinKey = NocturneDB.formatAssetKey(shitcoin);
    const shitcoinNotes = map.get(shitcoinKey);
    expect(shitcoinNotes).to.not.be.undefined;
    expect(shitcoinNotes!.length).to.equal(
      notes.length - notesToNullify.length
    );
    expect(shitcoinNotes!).to.not.have.deep.members(
      notesToNullify.map(toIncludedNote)
    );
  });

  it("nullifies all notes for a given asset", async () => {
    const [notes, _] = dummyNotesAndNfs(20, shitcoin, ponzi);
    await db.storeNotes(withDummyTotalEntityIndices(notes));

    // nullify all of the ponzi notes
    const ponziNotes = notes.filter(
      (n) => AssetTrait.hash(n.asset) === AssetTrait.hash(ponzi)
    );
    const ponziNfs = ponziNotes.map((n) => n.nullifier);

    await db.nullifyNotes(ponziNfs);
    const map = await db.getAllNotes({
      includeUncommitted: true,
      ignoreOptimisticNFs: true,
    });

    const ponziKey = NocturneDB.formatAssetKey(ponzi);
    const ponziNotesGot = map.get(ponziKey);
    expect(ponziNotesGot).to.be.undefined;

    const shitcoinKey = NocturneDB.formatAssetKey(shitcoin);
    const shitcoinNotesExpected = notes
      .filter((n) => AssetTrait.hash(n.asset) === AssetTrait.hash(shitcoin))
      .map(toIncludedNote);
    const shitcoinNotesGot = map.get(shitcoinKey);
    expect(shitcoinNotesGot).to.not.be.undefined;
    expect(shitcoinNotesGot!.length).to.eql(shitcoinNotesExpected.length);
  });

  it("nullifies multiple notes with different assets", async () => {
    const [notes, _] = dummyNotesAndNfs(20, shitcoin, ponzi, stablescam);

    const shitcoinNotes = notes.filter(
      (n) => AssetTrait.hash(n.asset) === AssetTrait.hash(shitcoin)
    );
    const ponziNotes = notes.filter(
      (n) => AssetTrait.hash(n.asset) === AssetTrait.hash(ponzi)
    );
    const stablescamNotes = notes.filter(
      (n) => AssetTrait.hash(n.asset) === AssetTrait.hash(stablescam)
    );

    await db.storeNotes(withDummyTotalEntityIndices(notes));

    // nullify a some each asset's notes
    const shitcoinNotesToNullify = shitcoinNotes.filter((_, i) => i % 3 === 0);
    const ponziNotesToNullify = ponziNotes.filter((_, i) => i % 2 === 0);
    const stablescamNotesToNullify = stablescamNotes.filter(
      (_, i) => i % 5 === 0
    );

    const nfsToApply = [
      ...shitcoinNotesToNullify.map((n) => n.nullifier),
      ...ponziNotesToNullify.map((n) => n.nullifier),
      ...stablescamNotesToNullify.map((n) => n.nullifier),
    ];

    await db.nullifyNotes(nfsToApply);
    const map = await db.getAllNotes({
      includeUncommitted: true,
      ignoreOptimisticNFs: true,
    });

    const shitcoinKey = NocturneDB.formatAssetKey(shitcoin);
    const shitcoinNotesGot = map.get(shitcoinKey);
    expect(shitcoinNotesGot).to.not.be.undefined;
    expect(shitcoinNotesGot!.length).to.eql(
      shitcoinNotes.length - shitcoinNotesToNullify.length
    );
    expect(shitcoinNotesGot!).to.not.have.deep.members(
      shitcoinNotesToNullify.map(toIncludedNote)
    );

    const ponziKey = NocturneDB.formatAssetKey(ponzi);
    const ponziNotesGot = map.get(ponziKey);
    expect(ponziNotesGot).to.not.be.undefined;
    expect(ponziNotesGot!.length).to.eql(
      ponziNotes.length - ponziNotesToNullify.length
    );
    expect(ponziNotesGot!).to.not.have.deep.members(
      ponziNotesToNullify.map(toIncludedNote)
    );

    const stablescamKey = NocturneDB.formatAssetKey(stablescam);
    const stablescamNotesGot = map.get(stablescamKey);
    expect(stablescamNotesGot).to.not.be.undefined;
    expect(stablescamNotesGot!.length).to.eql(
      stablescamNotes.length - stablescamNotesToNullify.length
    );
    expect(stablescamNotesGot!).to.not.have.deep.members(
      stablescamNotesToNullify.map(toIncludedNote)
    );
  });

  it("gets all notes for a given asset", async () => {
    const [notes, _] = dummyNotesAndNfs(20, shitcoin, ponzi, stablescam);
    await db.storeNotes(withDummyTotalEntityIndices(notes));

    for (const asset of [shitcoin, ponzi, stablescam]) {
      const assetHash = AssetTrait.hash(asset);
      const notesExpected = notes
        .filter((n) => AssetTrait.hash(n.asset) === assetHash)
        .map(toIncludedNote);
      const notesGot = await db.getNotesForAsset(asset, {
        includeUncommitted: true,
        ignoreOptimisticNFs: true,
      });

      expect(notesGot).to.not.be.undefined;
      expect(notesGot!.length).to.eql(notesExpected.length);
      expect(notesGot!).to.have.deep.members(notesExpected);
    }
  });

  it("only returns committed notes when getting all notes without { includeUncommitted: true }", async () => {
    const [notes, _] = dummyNotesAndNfs(20, shitcoin, ponzi, stablescam);
    await db.storeNotes(withDummyTotalEntityIndices(notes));

    const allCommittedNotes = await db.getAllNotes();
    expect(allCommittedNotes.size).to.eql(0);
  });

  it("only returns committed notes when getting notes for a given asset without { includeUncommitted: true }", async () => {
    const [notes, _] = dummyNotesAndNfs(20, shitcoin, ponzi, stablescam);
    await db.storeNotes(withDummyTotalEntityIndices(notes));

    for (const asset of [shitcoin, ponzi, stablescam]) {
      const notesGot = await db.getNotesForAsset(asset);

      expect(notesGot).to.not.be.undefined;
      expect(notesGot!.length).to.eql(0);
    }
  });

  it("gets and sets op history", async () => {
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

    await db.addOpToHistory(ops[0], metas[0], OperationStatus.BUNDLE_REVERTED);
    await db.addOpToHistory(ops[1], metas[1], OperationStatus.EXECUTED_SUCCESS);
    await db.addOpToHistory(ops[2], metas[2]);

    // get history without pending, expect to not have third op
    {
      const history = await db.getHistory();
      expect(history.length).to.eql(2);
    }

    // get the history
    const history = await db.getHistory(true);
    expect(history.length).to.eql(3);

    // check that the op digests match
    expect(history[0].digest).to.eql(OperationTrait.computeDigest(ops[0]));
    expect(history[1].digest).to.eql(OperationTrait.computeDigest(ops[1]));
    expect(history[2].digest).to.eql(OperationTrait.computeDigest(ops[2]));

    // check that metadatas match
    expect(history[0].metadata).to.eql(metas[0]);
    expect(history[1].metadata).to.eql(metas[1]);
    expect(history[2].metadata).to.eql(metas[2]);

    // check statuses match
    expect(history[0].status).to.eql(OperationStatus.BUNDLE_REVERTED);
    expect(history[1].status).to.eql(OperationStatus.EXECUTED_SUCCESS);
    expect(history[2].status).to.be.undefined;
  });

  it("applies optimistic nullifiers when adding op to history", async () => {
    // add an op with 5 joinsplits to history
    const op = dummyOp(5, shitcoin);
    const { oldNotes } = getNotesAndNfsFromOp(op);
    await db.storeNotes(withDummyTotalEntityIndices(oldNotes));

    await db.addOpToHistory(op, { items: [] });

    // if the old notes were optimistically nullified, we expect `getAllNotes` to return an empty map
    const allNotes = await db.getAllNotes({ includeUncommitted: true });
    expect(allNotes.size).to.eql(0);
  });

  it("removes ops from history", async () => {
    const op1 = dummyOp(5, shitcoin);
    const op2 = dummyOp(5, shitcoin);
    await db.addOpToHistory(op1, { items: [] });
    await db.addOpToHistory(op2, { items: [] });

    await db.removeOpFromHistory(OperationTrait.computeDigest(op1));

    const history = await db.getHistory(true);
    expect(history.length).to.eql(1);
    expect(history[0].digest).to.eql(OperationTrait.computeDigest(op2));
  });

  it("sets op status in history", async () => {
    const op = dummyOp(5, shitcoin);
    await db.addOpToHistory(op, { items: [] });

    {
      const history = await db.getHistory(true);
      expect(history.length).to.eql(1);
      expect(history[0].status).to.be.undefined;
    }

    await db.setStatusForOp(
      OperationTrait.computeDigest(op),
      OperationStatus.EXECUTED_SUCCESS
    );

    {
      const history = await db.getHistory(true);
      expect(history.length).to.eql(1);
      expect(history[0].status).to.eql(OperationStatus.EXECUTED_SUCCESS);
    }
  });

  it("removes optimistic nullifiers when op marked as failed in history", async () => {
    // add an op with 5 joinsplits to history
    const op = dummyOp(5, shitcoin);
    const { oldNotes } = getNotesAndNfsFromOp(op);
    await db.storeNotes(withDummyTotalEntityIndices(oldNotes));

    await db.addOpToHistory(op, { items: [] });
    // expect there to be optimistic NFs in db
    {
      const optimisticNfs = await db.getAllOptimisticNFRecords();
      expect(optimisticNfs.size).to.eql(oldNotes.length);

      const allNotes = await db.getAllNotes({ includeUncommitted: true });
      const notes = [...allNotes.values()].flat();
      expect(notes.length).to.eql(0);
    }

    await db.setStatusForOp(
      OperationTrait.computeDigest(op),
      OperationStatus.BUNDLE_REVERTED
    );

    // expect optimistic NFs to be removed
    {
      const optimisticNfs = await db.getAllOptimisticNFRecords();
      expect(optimisticNfs.size).to.eql(0);

      const allNotes = await db.getAllNotes({ includeUncommitted: true });
      const notes = [...allNotes.values()].flat();
      expect(notes.length).to.eql(oldNotes.length);
    }
  });
});

function withDummyTotalEntityIndices<T>(arr: T[]): WithTotalEntityIndex<T>[] {
  return arr.map((t) => ({ inner: t, totalEntityIndex: 0n }));
}
