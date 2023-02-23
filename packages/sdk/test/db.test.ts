import "mocha";
import { expect } from "chai";
import {
  NotesDB,
  InMemoryKVStore,
  MerkleDB,
  KV,
  IncludedNote,
  Asset,
  zip,
  NocturneViewer,
  range,
  NoteTrait,
  groupBy,
  IncludedNoteWithNullifier,
  AssetTrait,
} from "../src";
import { ponzi, shitcoin, stablescam } from "./utils";

describe("InMemoryKVStore", async () => {
  const kv = new InMemoryKVStore();

  afterEach(async () => {
    await kv.clear();
  });

  after(async () => {
    await kv.close();
  });

  it("Stores, gets, and removes primitive values in KV", async () => {
    await kv.putString("hello", "world");

    const val = await kv.getString("hello");
    expect(val).to.equal("world");

    await kv.remove("hello");
    expect(await kv.getString("hello")).to.be.undefined;

    await kv.putNumber("abc", 123);
    expect(await kv.getNumber("abc")).to.equal(123);

    await kv.putBigInt("Mehmet the conqueror", 1453n);
    expect(await kv.getBigInt("Mehmet the conqueror")).to.equal(1453n);
  });

  it("iterates over ranges", async () => {
    const rangeVals: KV[] = [
      ["a", "1"],
      ["b", "2"],
      ["c", "3"],
      ["d", "4"],
      ["e", "5"],
    ];

    await kv.putMany(rangeVals);

    let i = 0;
    for await (const [key, value] of await kv.iterRange("a", "e")) {
      expect(key).to.eql(rangeVals[i][0]);
      expect(value).to.eql(rangeVals[i][1]);
      i++;
    }

    // expect to have iterated over every key-value pair but the last
    expect(i).to.equal(rangeVals.length - 1);
  });

  it("iterates over prefixes", async () => {
    const prefixVals: KV[] = [
      ["aaa", "1"],
      ["aab", "2"],
      ["aac", "3"],
      ["aad", "4"],
      ["e", "5"],
    ];

    await kv.putMany(prefixVals);

    let i = 0;
    for await (const [key, value] of await kv.iterPrefix("a")) {
      expect(key).to.eql(prefixVals[i][0]);
      expect(value).to.eql(prefixVals[i][1]);
      i++;
    }

    // expect to have iterated over every key-value put ("e", "5")
    expect(i).to.equal(prefixVals.length - 1);
  });

  it("performs batch ops", async () => {
    const kvs: KV[] = [
      ["a", "1"],
      ["b", "2"],
      ["c", "3"],
      ["d", "4"],
      ["e", "5"],
    ];

    await kv.putMany(kvs);

    for (const [key, value] of kvs) {
      const val = await kv.getString(key);
      expect(val).to.eql(value);
    }

    const gotKvs = await kv.getMany(kvs.map(([k, _]) => k));
    for (const [[k, v], [key, value]] of zip(kvs, gotKvs)) {
      expect(k).to.eql(key);
      expect(v).to.eql(value);
    }

    await kv.removeMany(kvs.map(([k, _]) => k));

    for (const [key, _] of kvs) {
      const val = await kv.getString(key);
      expect(val).to.be.undefined;
    }
  });

  it("dumps", async () => {
    const kvs: KV[] = [
      ["a", "1"],
      ["b", "2"],
      ["c", "3"],
      ["d", "4"],
      ["e", "5"],
    ];

    await kv.putMany(kvs);

    const dump = await kv.dump();
    for (const [key, value] of kvs) {
      expect(dump[key]).to.not.be.undefined;
      expect(dump[key]).to.eql(value);
    }
  });

  it("loads from a dump", async () => {
    const kvs: KV[] = [
      ["a", "1"],
      ["b", "2"],
      ["c", "3"],
      ["d", "4"],
      ["e", "5"],
    ];

    await kv.putMany(kvs);

    const dump = await kv.dump();

    const newKV = new InMemoryKVStore();
    await newKV.loadFromDump(dump);

    for await (const [key, value] of await newKV.iterRange("a", "f")) {
      expect(dump[key]).to.not.be.undefined;
      expect(value).to.eql(dump[key]);
    }
  });
});

describe("NotesDB", async () => {
  const kv = new InMemoryKVStore();
  const db = new NotesDB(kv);
  const viewer = new NocturneViewer(1n);

  const dummyNotesAndNfs = (
    notesPerAsset: number,
    ...assets: Asset[]
  ): [IncludedNoteWithNullifier[], bigint[]] => {
    const owner = viewer.generateRandomStealthAddress();
    const notes: IncludedNoteWithNullifier[] = [];
    const nullifiers: bigint[] = [];
    let offset = 0;
    for (const asset of assets) {
      const _notes: IncludedNote[] = range(notesPerAsset).map((i) => ({
        owner,
        nonce: BigInt(i + offset),
        asset,
        value: 100n,
        merkleIndex: i + offset,
      }));
      const _nfs = _notes.map((n) => viewer.createNullifier(n));
      const notesWithNFs = zip(_notes, _nfs).map(([n, nf]) =>
        NoteTrait.toIncludedNoteWithNullifier(n, nf)
      );

      notes.push(...notesWithNFs);
      nullifiers.push(...notes.map((n) => viewer.createNullifier(n)));

      offset += notesPerAsset;
    }

    return [notes, nullifiers];
  };

  const toIncludedNote = ({ nullifier, ...rest }: IncludedNoteWithNullifier) =>
    rest;

  afterEach(async () => {
    await db.kv.clear();
  });

  after(async () => {
    await db.kv.close();
  });

  it("Stores a batch of notes/commitments with a single asset", async () => {
    const [_notes, _] = dummyNotesAndNfs(20, shitcoin);
    const [notes, toBeCommitments] = groupBy(_notes, (n) =>
      (n.merkleIndex % 2).toString()
    );
    const notesAndCommitments = [
      ...notes,
      ...toBeCommitments.map((note) => NoteTrait.toIncludedCommitment(note)),
    ];

    await db.storeNotesAndCommitments(notesAndCommitments);

    const map = await db.getAllNotes();
    const assetKey = NotesDB.formatAssetKey(shitcoin);
    const shitcoinNotes = map.get(assetKey)!;
    const shitcoinNotesExpected = notes.map(toIncludedNote);
    expect(shitcoinNotes).to.not.be.undefined;
    expect(shitcoinNotes).to.eql(shitcoinNotesExpected);
  });

  it("stores a batch of notes/commitments with a multiple assets", async () => {
    const [_notes, _] = dummyNotesAndNfs(20, shitcoin, ponzi, stablescam);
    const [notes, toBeCommitments] = groupBy(_notes, (n) =>
      (n.merkleIndex % 2).toString()
    );
    const notesAndCommitments = [
      ...notes,
      ...toBeCommitments.map((note) => NoteTrait.toIncludedCommitment(note)),
    ];

    await db.storeNotesAndCommitments(notesAndCommitments);

    const map = await db.getAllNotes();

    for (const asset of [shitcoin, ponzi, stablescam]) {
      const assetKey = NotesDB.formatAssetKey(asset);
      const assetHash = AssetTrait.hash(asset);
      const assetNotesExpected = notes
        .filter((n) => AssetTrait.hash(n.asset) === assetHash)
        .map(toIncludedNote);
      const assetNotesGot = map.get(assetKey)!;
      expect(assetNotesGot).to.not.be.undefined;
      expect(assetNotesGot).to.have.deep.members(assetNotesExpected);
    }
  });

  it("removes one note by nullifier", async () => {
    const [_notes, _] = dummyNotesAndNfs(20, shitcoin);
    const [notes, toBeCommitments] = groupBy(_notes, (n) =>
      (n.merkleIndex % 2).toString()
    );
    const notesAndCommitments = [
      ...notes,
      ...toBeCommitments.map((note) => NoteTrait.toIncludedCommitment(note)),
    ];

    await db.storeNotesAndCommitments(notesAndCommitments);

    const noteToNullify = notes[0];
    const nfToApply = noteToNullify.nullifier;

    await db.removeNotesByNullifier([nfToApply]);
    const map = await db.getAllNotes();

    const shitcoinKey = NotesDB.formatAssetKey(shitcoin);
    const shitcoinNotes = map.get(shitcoinKey);
    expect(shitcoinNotes).to.not.be.undefined;
    expect(shitcoinNotes!.length).to.equal(notes.length - 1);
    expect(shitcoinNotes!).to.not.deep.include(toIncludedNote(noteToNullify));
  });

  it("removes multiple notes by nullifier", async () => {
    const [_notes, _] = dummyNotesAndNfs(20, shitcoin);
    const [notes, toBeCommitmetns] = groupBy(_notes, (n) =>
      (n.merkleIndex % 2).toString()
    );
    const notesAndCommitments = [
      ...notes,
      ...toBeCommitmetns.map((note) => NoteTrait.toIncludedCommitment(note)),
    ];

    await db.storeNotesAndCommitments(notesAndCommitments);

    // remove the first 10 notes
    const notesToNullify = notes.slice(10);
    const nfsToApply = notesToNullify.map((n) => n.nullifier);

    await db.removeNotesByNullifier(nfsToApply);
    const map = await db.getAllNotes();

    const shitcoinKey = NotesDB.formatAssetKey(shitcoin);
    const shitcoinNotes = map.get(shitcoinKey);
    expect(shitcoinNotes).to.not.be.undefined;
    expect(shitcoinNotes!.length).to.equal(
      notes.length - notesToNullify.length
    );
    expect(shitcoinNotes!).to.not.have.deep.members(
      notesToNullify.map(toIncludedNote)
    );
  });

  it("removes all notes for a given asset by nullifier", async () => {
    const [_notes, _] = dummyNotesAndNfs(20, shitcoin, ponzi);
    const [notes, toBeCommitmetns] = groupBy(_notes, (n) =>
      (n.merkleIndex % 2).toString()
    );
    const notesAndCommitments = [
      ...notes,
      ...toBeCommitmetns.map((note) => NoteTrait.toIncludedCommitment(note)),
    ];

    await db.storeNotesAndCommitments(notesAndCommitments);

    // remove all of the ponzi notes
    const ponziNotes = notes.filter(
      (n) => AssetTrait.hash(n.asset) === AssetTrait.hash(ponzi)
    );
    const ponziNfs = ponziNotes.map((n) => n.nullifier);

    await db.removeNotesByNullifier(ponziNfs);
    const map = await db.getAllNotes();

    const ponziKey = NotesDB.formatAssetKey(ponzi);
    const ponziNotesGot = map.get(ponziKey);
    expect(ponziNotesGot).to.be.undefined;

    const shitcoinKey = NotesDB.formatAssetKey(shitcoin);
    const shitcoinNotesExpected = notes
      .filter((n) => AssetTrait.hash(n.asset) === AssetTrait.hash(shitcoin))
      .map(toIncludedNote);
    const shitcoinNotesGot = map.get(shitcoinKey);
    expect(shitcoinNotesGot).to.not.be.undefined;
    expect(shitcoinNotesGot!.length).to.eql(shitcoinNotesExpected.length);
  });

  it("removes multiple notes with different assets by nullifier", async () => {
    const [_notes, _] = dummyNotesAndNfs(20, shitcoin, ponzi, stablescam);
    const [notes, toBeCommitmetns] = groupBy(_notes, (n) =>
      (n.merkleIndex % 2).toString()
    );
    const notesAndCommitments = [
      ...notes,
      ...toBeCommitmetns.map((note) => NoteTrait.toIncludedCommitment(note)),
    ];

    const shitcoinNotes = notes.filter(
      (n) => AssetTrait.hash(n.asset) === AssetTrait.hash(shitcoin)
    );
    const ponziNotes = notes.filter(
      (n) => AssetTrait.hash(n.asset) === AssetTrait.hash(ponzi)
    );
    const stablescamNotes = notes.filter(
      (n) => AssetTrait.hash(n.asset) === AssetTrait.hash(stablescam)
    );

    await db.storeNotesAndCommitments(notesAndCommitments);

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

    await db.removeNotesByNullifier(nfsToApply);
    const map = await db.getAllNotes();

    const shitcoinKey = NotesDB.formatAssetKey(shitcoin);
    const shitcoinNotesGot = map.get(shitcoinKey);
    expect(shitcoinNotesGot).to.not.be.undefined;
    expect(shitcoinNotesGot!.length).to.eql(
      shitcoinNotes.length - shitcoinNotesToNullify.length
    );
    expect(shitcoinNotesGot!).to.not.have.deep.members(
      shitcoinNotesToNullify.map(toIncludedNote)
    );

    const ponziKey = NotesDB.formatAssetKey(ponzi);
    const ponziNotesGot = map.get(ponziKey);
    expect(ponziNotesGot).to.not.be.undefined;
    expect(ponziNotesGot!.length).to.eql(
      ponziNotes.length - ponziNotesToNullify.length
    );
    expect(ponziNotesGot!).to.not.have.deep.members(
      ponziNotesToNullify.map(toIncludedNote)
    );

    const stablescamKey = NotesDB.formatAssetKey(stablescam);
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
    const [_notes, _] = dummyNotesAndNfs(20, shitcoin, ponzi, stablescam);
    const [notes, toBeCommitmetns] = groupBy(_notes, (n) =>
      (n.merkleIndex % 2).toString()
    );
    const notesAndCommitments = [
      ...notes,
      ...toBeCommitmetns.map((note) => NoteTrait.toIncludedCommitment(note)),
    ];

    await db.storeNotesAndCommitments(notesAndCommitments);

    for (const asset of [shitcoin, ponzi, stablescam]) {
      const assetHash = AssetTrait.hash(asset);
      const notesExpected = notes
        .filter((n) => AssetTrait.hash(n.asset) === assetHash)
        .map(toIncludedNote);
      const notesGot = await db.getNotesForAsset(asset);

      expect(notesGot).to.not.be.undefined;
      expect(notesGot!.length).to.eql(notesExpected.length);
      expect(notesGot!).to.have.deep.members(notesExpected);
    }
  });
});

describe("MerkleDB", async () => {
  const kv = new InMemoryKVStore();
  const db = new MerkleDB(kv);

  afterEach(async () => {
    await kv.clear();
  });

  after(async () => {
    await kv.close();
  });

  it("Stores and gets merkle leaves", async () => {
    await db.storeLeaf(0, 0n);
    await db.storeLeaf(1, 1n);
    await db.storeLeaf(2, 2n);
    expect(await db.getLeaf(0)).to.eql(0n);
    expect(await db.getLeaf(1)).to.eql(1n);
    expect(await db.getLeaf(2)).to.eql(2n);
  });
});
