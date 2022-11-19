import "mocha";
import * as fs from "fs";
import { expect } from "chai";
import { FlaxContext } from "../src/FlaxContext";
import { AssetRequest, AssetStruct } from "../src/commonTypes";
import { IncludedNoteStruct } from "../src/sdk/note";
import { FlaxSigner } from "../src/sdk/signer";
import { FlaxPrivKey } from "../src/crypto/privkey";
import { MockSpend2Prover } from "../src/proof/mock";
import {
  DEFAULT_DB_PATH,
  LocalFlaxDB,
  LocalMerkleProver,
  LocalNotesManager,
} from "../src/sdk";
import { getDefaultProvider } from "ethers";

describe("FlaxContext", () => {
  let db = new LocalFlaxDB({ localMerkle: true });
  let flaxContext: FlaxContext;
  const asset: AssetStruct = { address: "0x12345", id: 11111n };

  async function setupFlaxContextWithFourNotes(
    asset: AssetStruct
  ): Promise<FlaxContext> {
    const sk = BigInt(1);
    const flaxPrivKey = new FlaxPrivKey(sk);
    const signer = new FlaxSigner(flaxPrivKey);

    const firstOldNote: IncludedNoteStruct = {
      owner: signer.address.toStruct(),
      nonce: 0n,
      asset: asset.address,
      id: asset.id,
      value: 100n,
      merkleIndex: 0,
    };
    const secondOldNote: IncludedNoteStruct = {
      owner: signer.address.toStruct(),
      nonce: 1n,
      asset: asset.address,
      id: asset.id,
      value: 50n,
      merkleIndex: 1,
    };
    const thirdOldNote: IncludedNoteStruct = {
      owner: signer.address.toStruct(),
      nonce: 2n,
      asset: asset.address,
      id: asset.id,
      value: 25n,
      merkleIndex: 2,
    };
    const fourthOldNote: IncludedNoteStruct = {
      owner: signer.address.toStruct(),
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

    const prover = new MockSpend2Prover();
    const merkleProver = new LocalMerkleProver(
      "0xaaaa",
      getDefaultProvider(),
      db
    );
    const notesManager = new LocalNotesManager(
      db,
      signer,
      "0xaaaa",
      getDefaultProvider()
    );

    return new FlaxContext(signer, prover, merkleProver, notesManager, db);
  }

  beforeEach(async () => {
    flaxContext = await setupFlaxContextWithFourNotes(asset);
  });

  afterEach(async () => {
    db.clear();
  });

  after(async () => {
    await db.close();
    fs.rmSync(DEFAULT_DB_PATH, { recursive: true, force: true });
  });

  it("Gets total balance for an asset", async () => {
    const assetBalance = await flaxContext.getAssetBalance(asset);
    expect(assetBalance).to.equal(100n + 50n + 25n + 10n);
  });

  it("Gathers minimum notes for asset request", async () => {
    const refundAddr = flaxContext.signer.address.rerand().toStruct();

    // Request 20 tokens, consume smallest note
    const assetRequest5: AssetRequest = {
      asset,
      value: 5n,
    };
    const minimumFor5 = await flaxContext.gatherMinimumNotes(
      refundAddr,
      assetRequest5
    );
    expect(minimumFor5.length).to.equal(1);
    expect(minimumFor5[0].oldNote.inner.value).to.equal(10n);

    // Request 80 tokens, consume next smallest two notes
    const assetRequest80: AssetRequest = {
      asset,
      value: 80n,
    };
    const minimumFor80 = await flaxContext.gatherMinimumNotes(
      refundAddr,
      assetRequest80
    );

    expect(minimumFor80.length).to.equal(3);
    expect(minimumFor80[2].oldNote.inner.value).to.equal(50n);
    expect(minimumFor80[1].oldNote.inner.value).to.equal(25n);
    expect(minimumFor80[0].oldNote.inner.value).to.equal(10n);
  });
});
