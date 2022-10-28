import "mocha";
import { expect } from "chai";
import { FlaxContext } from "../src/FlaxContext";
import { Asset, AssetRequest, ERC20_ID } from "../src/commonTypes";
import { Note, IncludedNote } from "../src/sdk/note";
import { FlaxSigner } from "../src/sdk/signer";
import { FlaxPrivKey } from "../src/crypto/privkey";
import { BinaryPoseidonTree } from "../src/primitives/binaryPoseidonTree";

describe("FlaxContext", () => {
  function setupFlaxContextWithFourNotes(
    signer: FlaxSigner,
    asset: Asset
  ): FlaxContext {
    const firstOldNote = new Note({
      owner: signer.address.toFlattened(),
      nonce: 0n,
      asset: asset.address,
      id: ERC20_ID,
      value: 100n,
    });
    const secondOldNote = new Note({
      owner: signer.address.toFlattened(),
      nonce: 1n,
      asset: asset.address,
      id: ERC20_ID,
      value: 50n,
    });
    const thirdOldNote = new Note({
      owner: signer.address.toFlattened(),
      nonce: 2n,
      asset: asset.address,
      id: ERC20_ID,
      value: 25n,
    });
    const fourthOldNote = new Note({
      owner: signer.address.toFlattened(),
      nonce: 3n,
      asset: asset.address,
      id: ERC20_ID,
      value: 10n,
    });

    const prover = new BinaryPoseidonTree();
    prover.insert(firstOldNote.toCommitment());
    prover.insert(secondOldNote.toCommitment());
    prover.insert(thirdOldNote.toCommitment());
    prover.insert(fourthOldNote.toCommitment());

    const tokenToNotes = new Map([
      [
        asset.hash(),
        [
          new IncludedNote(firstOldNote, 0),
          new IncludedNote(secondOldNote, 1),
          new IncludedNote(thirdOldNote, 2),
          new IncludedNote(fourthOldNote, 3),
        ],
      ],
    ]);

    return new FlaxContext(signer, tokenToNotes, prover);
  }

  it("Gets total balance for an asset", () => {
    const priv = FlaxPrivKey.genPriv();
    const signer = new FlaxSigner(priv);
    const asset: Asset = new Asset("0x12345", 11111n);

    const flaxContext = setupFlaxContextWithFourNotes(signer, asset);

    const assetBalance = flaxContext.getAssetBalance(asset);
    expect(assetBalance).to.equal(100n + 50n + 25n + 10n);
  });

  it("Gathers minimum notes for asset request", () => {
    const priv = FlaxPrivKey.genPriv();
    const signer = new FlaxSigner(priv);
    const asset: Asset = new Asset("0x12345", 11111n);

    const flaxContext = setupFlaxContextWithFourNotes(signer, asset);
    const refundAddr = signer.address.rerand().toFlattened();

    // Request 20 tokens, consume smallest note
    const assetRequest5: AssetRequest = {
      asset,
      value: 5n,
    };
    const minimumFor5 = flaxContext.gatherMinimumNotes(
      refundAddr,
      assetRequest5
    );
    expect(minimumFor5.length).to.equal(1);
    expect(minimumFor5[0].oldNote.value).to.equal(10n);
    expect(flaxContext.ownedNotes.get(asset.hash())!.length).to.equal(3);

    // Request 60 tokens, consume next smallest two notes
    const assetRequest60: AssetRequest = {
      asset,
      value: 60n,
    };
    const minimumFor60 = flaxContext.gatherMinimumNotes(
      refundAddr,
      assetRequest60
    );
    expect(minimumFor60.length).to.equal(2);
    expect(minimumFor60[1].oldNote.value).to.equal(50n);
    expect(minimumFor60[0].oldNote.value).to.equal(25n);
    expect(flaxContext.ownedNotes.get(asset.hash())!.length).to.equal(1);
  });
});
