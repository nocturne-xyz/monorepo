import "mocha";
import { expect } from "chai";
import { NotesDB, InMemoryKVStore, MerkleDB, KV } from "../src/sdk/db";
import { IncludedNote } from "../src/sdk/note";
import { Asset, AssetType } from "../src/commonTypes";

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

  afterEach(async () => {
    await db.kv.clear();
  });

  after(async () => {
    await db.kv.close();
  });

  it("Stores, gets, and removes notes", async () => {
    const asset: Asset = {
      assetType: AssetType.ERC20,
      assetAddr: "0x1234",
      id: 1234n,
    };
    const note: IncludedNote = {
      owner: {
        h1X: 1n,
        h1Y: 2n,
        h2X: 3n,
        h2Y: 4n,
      },
      nonce: 5n,
      asset,
      value: 100n,
      merkleIndex: 6,
    };

    await db.storeNote(note);

    const map = await db.getAllNotes();
    const notesArray = map.get(NotesDB.formatNoteAssetKey(asset))!;
    expect(notesArray).to.not.be.undefined;
    expect(notesArray[0]).to.eql(note);

    await db.removeNote(note);
    const newMap = await db.getAllNotes();
    expect(newMap.get(NotesDB.formatNoteAssetKey(asset))).to.eql(undefined);
  });

  it("Stores, gets, and removes multiple notes for same asset", async () => {
    const asset: Asset = {
      assetType: AssetType.ERC20,
      assetAddr: "0x1234",
      id: 1234n,
    };
    const noteOne: IncludedNote = {
      owner: {
        h1X: 1n,
        h1Y: 2n,
        h2X: 3n,
        h2Y: 4n,
      },
      nonce: 5n,
      asset,
      value: 100n,
      merkleIndex: 6,
    };

    const noteTwo: IncludedNote = {
      owner: {
        h1X: 1n,
        h1Y: 2n,
        h2X: 3n,
        h2Y: 4n,
      },
      nonce: 5n,
      asset,
      value: 150n,
      merkleIndex: 7,
    };

    await db.storeNote(noteOne);
    await db.storeNote(noteTwo);

    const map = await db.getAllNotes();
    const notesArray = map.get(NotesDB.formatNoteAssetKey(asset))!;
    expect(notesArray).to.not.be.undefined;
    expect(notesArray.length).to.equal(2);
    expect(notesArray).to.deep.include(noteOne);
    expect(notesArray).to.deep.include(noteTwo);

    const notesForAsset = await db.getNotesFor(asset);
    expect(notesForAsset).to.not.be.undefined;
    expect(notesForAsset.length).to.equal(2);
    expect(notesForAsset).to.deep.include(noteOne);
    expect(notesForAsset).to.deep.include(noteTwo);

    await db.removeNote(noteOne);
    const newMap = await db.getAllNotes();
    const newNotesArray = newMap.get(NotesDB.formatNoteAssetKey(asset))!;
    expect(notesArray).to.not.be.undefined;
    expect(newNotesArray.length).to.eql(1);
    expect(newNotesArray[0]).to.eql(noteTwo);
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
