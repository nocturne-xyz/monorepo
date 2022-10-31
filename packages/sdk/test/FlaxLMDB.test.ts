import "mocha";
import { expect } from "chai";
import { FlaxDB, FlaxLMDB } from "../src/sdk/db";
import { IncludedNote } from "../src/sdk/note";
import { Asset } from "../src/commonTypes";
// import { IncludedNote, IncludedNoteStruct } from "../src/sdk/note";
// import { Asset } from "../src/commonTypes";

describe("FlaxLowDB", async () => {
  let db: FlaxLMDB;

  beforeEach(async () => {
    db = new FlaxLMDB();
    db.db.clearSync();
  });

  it("Gets and sets value", async () => {
    await db.putKv("hello", "world");
    const val = db.getKv("hello");
    expect(val).to.equal("world");
  });

  it("Stores and gets note", async () => {
    const asset = new Asset("0x1234", 1234n);
    const note = new IncludedNote({
      owner: {
        h1X: 1n,
        h1Y: 2n,
        h2X: 3n,
        h2Y: 4n,
      },
      nonce: 5n,
      asset: "0x1234",
      id: 1234n,
      value: 100n,
      merkleIndex: 6,
    });

    await db.storeNote(note);

    const map = db.getAllNotes();
    console.log(note);

    const val = map.get(FlaxDB.notesKey(asset));
    console.log(val);
    expect(map.get(FlaxDB.notesKey(asset))![0]).to.eql(note.toStruct());
  });
});
