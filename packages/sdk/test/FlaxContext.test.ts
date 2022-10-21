import "mocha";
import { expect } from "chai";
import { FlaxContext } from "../src/FlaxContext";
import { Asset, AssetRequest, ERC20_ID } from "../src/commonTypes";
import { Note, SpendableNote } from "../src/sdk/note";
import { FlaxSigner } from "../src/sdk/signer";
import { FlaxPrivKey } from "../src/crypto/privkey";
import { BinaryPoseidonTree } from "../src/primitives/binaryPoseidonTree";

describe("FlaxContext", () => {
  it("Gathers minimum notes for asset request", () => {
    const priv = FlaxPrivKey.genPriv();
    const signer = new FlaxSigner(priv);
    const asset: Asset = new Asset("0x12345", 11111n);

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

    const tree = new BinaryPoseidonTree();
    tree.insert(firstOldNote.toCommitment());
    tree.insert(secondOldNote.toCommitment());
    tree.insert(thirdOldNote.toCommitment());
    tree.insert(fourthOldNote.toCommitment());

    const tokenToNotes = new Map([
      [
        asset.hash(),
        [
          new SpendableNote(firstOldNote, tree.createProof(0)),
          new SpendableNote(secondOldNote, tree.createProof(1)),
          new SpendableNote(thirdOldNote, tree.createProof(2)),
          new SpendableNote(fourthOldNote, tree.createProof(3)),
        ],
      ],
    ]);

    const flaxContext = new FlaxContext(priv, tokenToNotes, tree);
    // const flaxContext0 = new FlaxContext(priv, tokenToNotes, tree);

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
    expect(flaxContext.tokenToNotes.get(asset.hash())!.length).to.equal(3);

    // Request 60 tokens, consume smallest two notes
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
    expect(flaxContext.tokenToNotes.get(asset.hash())!.length).to.equal(1);
  });
});
