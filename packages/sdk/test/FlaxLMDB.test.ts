import "mocha";
import * as fs from "fs";
import { expect } from "chai";
import { DEFAULT_DB_PATH, FlaxDB, FlaxLMDB } from "../src/sdk/db";
import { IncludedNoteStruct } from "../src/sdk/note";
import { AssetStruct } from "../src/commonTypes";

describe("FlaxLMDB", async () => {
  let db = new FlaxLMDB({ localMerkle: true });

  afterEach(async () => {
    db.clear();
  });

  after(async () => {
    await db.close();
    fs.rmSync(DEFAULT_DB_PATH, { recursive: true, force: true });
  });

  it("Stores, gets, and removes value", async () => {
    await db.putKv("hello", "world");

    const val = await db.getKv("hello");
    expect(val).to.equal("world");

    await db.removeKv("hello");
    expect(await db.getKv("hello")).to.be.undefined;
  });

  it("Stores, gets, and removes note", async () => {
    const asset: AssetStruct = { address: "0x1234", id: 1234n };
    const note: IncludedNoteStruct = {
      owner: {
        h1X: 1n,
        h1Y: 2n,
        h2X: 3n,
        h2Y: 4n,
      },
      nonce: 5n,
      asset: asset.address,
      id: asset.id,
      value: 100n,
      merkleIndex: 6,
    };

    await db.storeNote(note);

    const map = await db.getAllNotes();
    const notesArray = map.get(FlaxDB.notesKey(asset))!;
    expect(notesArray[0]).to.eql(note);

    await db.removeNote(note);
    const newMap = await db.getAllNotes();
    expect(newMap.get(FlaxDB.notesKey(asset))).to.be.undefined;
  });

  it("Stores, gets, and removes multiple notes for same asset", async () => {
    const asset: AssetStruct = { address: "0x1234", id: 1234n };
    const noteOne: IncludedNoteStruct = {
      owner: {
        h1X: 1n,
        h1Y: 2n,
        h2X: 3n,
        h2Y: 4n,
      },
      nonce: 5n,
      asset: asset.address,
      id: asset.id,
      value: 100n,
      merkleIndex: 6,
    };

    const noteTwo: IncludedNoteStruct = {
      owner: {
        h1X: 1n,
        h1Y: 2n,
        h2X: 3n,
        h2Y: 4n,
      },
      nonce: 5n,
      asset: asset.address,
      id: asset.id,
      value: 150n,
      merkleIndex: 7,
    };

    await db.storeNote(noteOne);
    await db.storeNote(noteTwo);

    const map = await db.getAllNotes();
    const notesArray = map.get(FlaxDB.notesKey(asset))!;
    expect(notesArray[0]).to.eql(noteOne);
    expect(notesArray[1]).to.eql(noteTwo);

    await db.removeNote(noteOne);
    const newMap = await db.getAllNotes();
    const newNotesArray = newMap.get(FlaxDB.notesKey(asset))!;
    expect(newNotesArray.length).to.eql(1);
    expect(newNotesArray[0]).to.eql(noteTwo);
  });

  it("Stores and gets merkle leaves", async () => {
    await db.storeLeaf(0, 0n);
    await db.storeLeaf(1, 1n);
    await db.storeLeaf(2, 2n);
    expect(db.getLeaf(0)).to.eql(0n);
    expect(db.getLeaf(1)).to.eql(1n);
    expect(db.getLeaf(2)).to.eql(2n);
  });
});
