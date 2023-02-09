import "mocha";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { expect } from "chai";
import { NocturnePrivKey } from "../src/crypto";
import { Asset, AssetType, InMemoryKVStore, MerkleProver, MockMerkleProver, NocturneSigner, NotesDB, sortNotesByValue } from "../src/sdk";
import { gatherNotes } from "../src/sdk/prepareOperation";

chai.use(chaiAsPromised);

const stablescam: Asset = {
  assetType: AssetType.ERC20,
  assetAddr: "0x789",
  id: 0n,
};

async function setup(noteAmounts: bigint[]): Promise<[NotesDB, MerkleProver, NocturneSigner]> {
  const priv = new NocturnePrivKey(1n);
  const signer = new NocturneSigner(priv);

  const kv = new InMemoryKVStore();
  const notesDB = new NotesDB(kv);
  const merkleProver = new MockMerkleProver();

  const notes = noteAmounts.map((amount, i) => ({
    owner: signer.address,
    nonce: BigInt(i),
    asset: stablescam,
    value: amount,
    merkleIndex: i,
  }));
  await notesDB.storeNotes(notes);

  return [notesDB, merkleProver, signer];
}

describe("gatherNotes", () => {
  it("throws an error when attempting to overspend", async () => {
    const [notesDB, , ] = await setup([100n]);

    // attempt request 1000 tokens, more than the user owns
    // expect to throw error
    await expect(
      gatherNotes(1000n, stablescam, notesDB)
    ).to.be.rejectedWith("Attempted to spend more funds than owned");
  });

  it("gathers the minimum notes for amount < smallest note", async () => {
    const [notesDB, , ] = await setup([100n, 10n]);

    // expect to get one note - the 10 token note
    const notes = await gatherNotes(5n, stablescam, notesDB);
    expect(notes).to.have.lengthOf(1);
    expect(notes[0].value).to.equal(10n);
  });

  it("gathers the minimum amount of notes for amount requiring all notes", async () => {
    const [notesDB, , ] = await setup([30n, 20n, 10n]);

    // attempt to request 55 tokens
    // expect to get all three notes
    const notes = await gatherNotes(55n, stablescam, notesDB);
    expect(notes).to.have.lengthOf(3);

    const sortedNotes = sortNotesByValue(notes);
    expect(sortedNotes[0].value).to.equal(10n);
    expect(sortedNotes[1].value).to.equal(20n);
    expect(sortedNotes[2].value).to.equal(30n);
  });

  it("gathers minimum amount of notes for a realistic-ish example", async () => {
    const [notesdb, , ] = await setup([1000n, 51n, 19n, 3n, 3n, 2n, 1n, 1n, 1n]);

    // attempt to spend 23 tokens
    // expect to get 4 notes - 19, 2, 1, 1
    // in principle, we could get away with 3 notes - 19, 3, 1. But we also want to
    // utilize small notes. this is what we'd expect to get from the algorithm
    const notes = await gatherNotes(23n, stablescam, notesdb);
    expect(notes).to.have.lengthOf(4);

    const sortedNotes = sortNotesByValue(notes);
    expect(sortedNotes[0].value).to.equal(1n);
    expect(sortedNotes[1].value).to.equal(1n);
    expect(sortedNotes[2].value).to.equal(2n);
    expect(sortedNotes[3].value).to.equal(19n);

    // check to ensure the 1 token notes are different
    expect(sortedNotes[0].nonce).to.not.equal(sortedNotes[1].nonce);
  })
})
