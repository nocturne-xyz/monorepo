import "mocha";
import { expect } from "chai";
import {
  NotesDB,
  InMemoryKVStore,
  MerkleDB,
  KV,
  IncludedNote,
  Asset,
  AssetType,
  zip,
  NocturneViewer,
  range,
  NoteTrait,
  groupBy,
} from "../src";

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

  afterEach(async () => {
    await db.kv.clear();
  });

  after(async () => {
    await db.kv.close();
  });

  it("Stores a batch of notes/commitments", async () => {
    const asset: Asset = {
      assetType: AssetType.ERC20,
      assetAddr: "0x1234",
      id: 1234n,
    };

    const owner = viewer.generateRandomStealthAddress();
    // half notes, half commitments
    const notes: IncludedNote[] = range(20).map((i) => ({
      owner,
      nonce: BigInt(i),
      asset,
      value: 100n,
      merkleIndex: i,
    }));

    const [toBeNotes, toBeCommitmetns] = groupBy(notes, (n) =>
      (n.merkleIndex % 2).toString()
    );

    const nullifiers = toBeNotes.map((n) => viewer.createNullifier(n));
    const notesWithNullfiers = zip(toBeNotes, nullifiers).map(([n, nf]) =>
      NoteTrait.toIncludedNoteWithNullifier(n, nf)
    );
    const notesOrCommitments = [
      ...notesWithNullfiers,
      ...toBeCommitmetns.map((note) => NoteTrait.toIncludedCommitment(note)),
    ];

    await db.storeNotesAndCommitments(notesOrCommitments);

    const map = await db.getAllNotes();
    const assetKey = NotesDB.formatAssetKey(asset);
    const notesArray = map.get(assetKey)!;
    expect(notesArray).to.not.be.undefined;
    expect(notesArray).to.eql(toBeNotes);

    await db.removeNotesByNullifier(nullifiers);
    const newMap = await db.getAllNotes();
    expect(newMap.get(assetKey)).to.eql(undefined);
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
