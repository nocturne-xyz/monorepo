import "mocha";
import * as fs from "fs";
import { expect } from "chai";
import { NocturneContext } from "../src/NocturneContext";
import { AssetRequest, AssetStruct } from "../src/commonTypes";
import { IncludedNote } from "../src/sdk/note";
import { NocturneSigner } from "../src/sdk/signer";
import { NocturnePrivKey } from "../src/crypto/privkey";
import { MockJoinSplitProver } from "../src/proof/mock";
import {
  DEFAULT_DB_PATH,
  LocalObjectDB,
  MockMerkleProver,
  LocalNotesManager,
} from "../src/sdk";
import { getDefaultProvider } from "ethers";

describe("NocturneContext", () => {
  let db = new LocalObjectDB({ localMerkle: true });
  let nocturneContext: NocturneContext;
  const asset: AssetStruct = { address: "0x1234", id: 11111n };

  async function setupNocturneContextWithFourNotes(
    asset: AssetStruct
  ): Promise<NocturneContext> {
    const sk = BigInt(1);
    const nocturnePrivKey = new NocturnePrivKey(sk);
    const signer = new NocturneSigner(nocturnePrivKey);

    const firstOldNote: IncludedNote = {
      owner: signer.address,
      nonce: 0n,
      asset: asset.address,
      id: asset.id,
      value: 100n,
      merkleIndex: 0,
    };
    const secondOldNote: IncludedNote = {
      owner: signer.address,
      nonce: 1n,
      asset: asset.address,
      id: asset.id,
      value: 50n,
      merkleIndex: 1,
    };
    const thirdOldNote: IncludedNote = {
      owner: signer.address,
      nonce: 2n,
      asset: asset.address,
      id: asset.id,
      value: 25n,
      merkleIndex: 2,
    };
    const fourthOldNote: IncludedNote = {
      owner: signer.address,
      nonce: 3n,
      asset: asset.address,
      id: asset.id,
      value: 10n,
      merkleIndex: 3,
    };

    await db.storeNotes([
      firstOldNote,
      secondOldNote,
      thirdOldNote,
      fourthOldNote,
    ]);

    const prover = new MockJoinSplitProver();
    const merkleProver = new MockMerkleProver();

    const notesManager = new LocalNotesManager(
      db,
      signer,
      "0xaaaa",
      getDefaultProvider()
    );

    return new NocturneContext(signer, prover, merkleProver, notesManager, db);
  }

  beforeEach(async () => {
    nocturneContext = await setupNocturneContextWithFourNotes(asset);
  });

  afterEach(async () => {
    db.clear();
  });

  after(async () => {
    await db.close();
    fs.rmSync(DEFAULT_DB_PATH, { recursive: true, force: true });
  });

  it("Gets total balance for an asset", async () => {
    const assetBalance = await nocturneContext.getAssetBalance(asset);
    expect(assetBalance).to.equal(100n + 50n + 25n + 10n);
  });

  it("Gets balances for all notes", async () => {
    const diffNote: IncludedNote = {
      owner: nocturneContext.signer.address,
      nonce: 5555n,
      asset: "0x5555",
      id: 5555n,
      value: 5555n,
      merkleIndex: 4,
    };

    await db.storeNote(diffNote);

    const allBalances = await nocturneContext.getAllAssetBalances();
    allBalances.sort((a, b) => {
      return Number(a.asset.id - b.asset.id);
    });
    expect(allBalances.length).to.equal(2);
    expect(allBalances[0].balance).to.equal(5555n);
    expect(allBalances[1].balance).to.equal(100n + 50n + 25n + 10n);
  });

  it("Rejects asset request attempting to overspend", async () => {
    // Request 1000 tokens, more than user owns
    const assetRequest1000: AssetRequest = {
      asset,
      value: 1000n,
    };
    try {
      await nocturneContext.ensureMinimumForAssetRequest(assetRequest1000);
      throw new Error("Request should have failed");
    } catch (e) {
      expect(e).to.be.instanceOf(Error);
    }
  });

  it("Gathers minimum notes for asset request", async () => {
    // Request 20 tokens, consume smallest note
    const assetRequest5: AssetRequest = {
      asset,
      value: 5n,
    };
    const minimumFor5 = await nocturneContext.gatherMinimumNotes(assetRequest5);
    expect(minimumFor5.length).to.equal(1);
    expect(minimumFor5[0].value).to.equal(10n);

    // Request 80 tokens, consume next smallest two notes
    const assetRequest80: AssetRequest = {
      asset,
      value: 80n,
    };
    const minimumFor80 = await nocturneContext.gatherMinimumNotes(
      assetRequest80
    );

    expect(minimumFor80.length).to.equal(3);
    expect(minimumFor80[2].value).to.equal(50n);
    expect(minimumFor80[1].value).to.equal(25n);
    expect(minimumFor80[0].value).to.equal(10n);
  });
});
