import "mocha";
import * as fs from "fs";
import { expect } from "chai";
import { DEFAULT_DB_PATH, FlaxDB, FlaxLMDB } from "../src/sdk/db";
import { IncludedNoteStruct } from "../src/sdk/note";
import { Asset } from "../src/commonTypes";

describe("FlaxLMDB", async () => {
  let db = new FlaxLMDB();

  beforeEach(async () => {
    db.clear();
  });

  after(async () => {
    await db.close();
    fs.rmSync(DEFAULT_DB_PATH, { recursive: true, force: true });
  });

  it("Gets and sets value", async () => {
    await db.putKv("hello", "world");
    const val = db.getKv("hello");
    expect(val).to.equal("world");
  });

  it("Stores and gets note", async () => {
    const asset = new Asset("0x1234", 1234n);
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

    const map = db.getAllNotes();
    const notesArray = map.get(FlaxDB.notesKey(asset))!;
    expect(notesArray[0]).to.eql(note);
  });

  it("Stores and gets multiple notes for same asset", async () => {
    const asset = new Asset("0x1234", 1234n);
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

    const map = db.getAllNotes();
    const notesArray = map.get(FlaxDB.notesKey(asset))!;
    expect(notesArray[0]).to.eql(noteOne);
    expect(notesArray[1]).to.eql(noteTwo);
  });
});
