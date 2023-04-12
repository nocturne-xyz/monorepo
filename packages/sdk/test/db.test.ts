import "mocha";
import { expect } from "chai";
import {
  NocturneDB,
  InMemoryKVStore,
  KV,
  IncludedNote,
  Asset,
  zip,
  NocturneViewer,
  range,
  NoteTrait,
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

  it("stores, gets, and removes primitive values in KV", async () => {
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

  it("dumps to an object", async () => {
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

describe("NocturneDB", async () => {
  const kv = new InMemoryKVStore();
  const db = new NocturneDB(kv);
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
      const allNotes: IncludedNote[] = range(notesPerAsset).map((i) => ({
        owner,
        nonce: BigInt(i + offset),
        asset,
        value: 100n,
        merkleIndex: i + offset,
      }));
      const allNfs = allNotes.map((n) => viewer.createNullifier(n));
      const notesWithNFs = zip(allNotes, allNfs).map(([n, nf]) =>
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

  it("stores a batch of notes with a single asset", async () => {
    const [notes, _] = dummyNotesAndNfs(20, shitcoin);
    await db.storeNotes(notes);

    const map = await db.getAllNotes();
    const assetKey = NocturneDB.formatAssetKey(shitcoin);
    const shitcoinNotes = map.get(assetKey)!;
    const shitcoinNotesExpected = notes.map(toIncludedNote);
    expect(shitcoinNotes).to.not.be.undefined;
    expect(shitcoinNotes).to.eql(shitcoinNotesExpected);
  });

  it("stores a batch of notes with multiple assets", async () => {
    const [notes, _] = dummyNotesAndNfs(20, shitcoin, ponzi, stablescam);
    await db.storeNotes(notes);

    const map = await db.getAllNotes();

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
    await db.storeNotes(notes);

    const noteToNullify = notes[0];
    const nfToApply = noteToNullify.nullifier;

    await db.nullifyNotes([nfToApply]);
    const map = await db.getAllNotes();

    const shitcoinKey = NocturneDB.formatAssetKey(shitcoin);
    const shitcoinNotes = map.get(shitcoinKey);
    expect(shitcoinNotes).to.not.be.undefined;
    expect(shitcoinNotes!.length).to.equal(notes.length - 1);
    expect(shitcoinNotes!).to.not.deep.include(toIncludedNote(noteToNullify));
  });

  it("nullifies multiple notes", async () => {
    const [notes, _] = dummyNotesAndNfs(20, shitcoin);
    await db.storeNotes(notes);

    // remove the first 10 notes
    const notesToNullify = notes.slice(10);
    const nfsToApply = notesToNullify.map((n) => n.nullifier);

    await db.nullifyNotes(nfsToApply);
    const map = await db.getAllNotes();

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
    await db.storeNotes(notes);

    // nullify all of the ponzi notes
    const ponziNotes = notes.filter(
      (n) => AssetTrait.hash(n.asset) === AssetTrait.hash(ponzi)
    );
    const ponziNfs = ponziNotes.map((n) => n.nullifier);

    await db.nullifyNotes(ponziNfs);
    const map = await db.getAllNotes();

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

    await db.storeNotes(notes);

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
    const map = await db.getAllNotes();

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
    await db.storeNotes(notes);

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
