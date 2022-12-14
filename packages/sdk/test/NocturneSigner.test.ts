import "mocha";
import { expect } from "chai";
import { NocturneSigner } from "../src/sdk/signer";
import { NocturnePrivKey } from "../src/crypto/privkey";
import { NocturneAddressTrait } from "../src/crypto/address";
import { genNoteTransmission } from "../src/crypto/utils";
import { encodeAsset, encodeID } from "../src/sdk";

describe("NocturneSigner", () => {
  it("View key should work", () => {
    const priv1 = NocturnePrivKey.genPriv();
    const signer1 = new NocturneSigner(priv1);
    const priv2 = NocturnePrivKey.genPriv();
    const signer2 = new NocturneSigner(priv2);
    expect(signer1.testOwn(signer1.address)).to.equal(true);
    expect(signer1.testOwn(signer2.address)).to.equal(false);
    expect(signer2.testOwn(signer2.address)).to.equal(true);
    expect(signer2.testOwn(signer1.address)).to.equal(false);
  });

  it("Test rerand", () => {
    const priv1 = NocturnePrivKey.genPriv();
    const signer1 = new NocturneSigner(priv1);
    const rerandAddr1 = NocturneAddressTrait.randomize(signer1.address);
    const priv2 = NocturnePrivKey.genPriv();
    const signer2 = new NocturneSigner(priv2);
    expect(signer1.testOwn(signer1.address)).to.equal(true);
    expect(signer1.testOwn(rerandAddr1)).to.equal(true);
    expect(signer2.testOwn(signer1.address)).to.equal(false);
    expect(signer2.testOwn(rerandAddr1)).to.equal(false);
  });

  it("Test address (de)serialization", () => {
    const priv = NocturnePrivKey.genPriv();
    const addr = priv.toAddress();
    const str = NocturneAddressTrait.toString(addr);
    expect(NocturneAddressTrait.fromString(str)).to.eql(addr);
  });

  it("Test Sign / verify", () => {
    const priv = NocturnePrivKey.genPriv();
    const pk = priv.spendPk();
    const signer = new NocturneSigner(priv);
    const m = BigInt(123);
    const sig = signer.sign(m);
    expect(NocturneSigner.verify(pk, m, sig)).to.equal(true);
  });

  it("Test note transmission", () => {
    const priv = NocturnePrivKey.genPriv();
    const signer = new NocturneSigner(priv);
    const addr = priv.toCanonAddress();
    const note = {
      owner: priv.toAddress(),
      nonce: 33n,
      asset: "0x123",
      id: 1n,
      value: 55n,
    };
    const noteTransmission = genNoteTransmission(addr, note);
    const note2 = signer.getNoteFromNoteTransmission(
      noteTransmission,
      2,
      "0x123",
      1n
    );
    expect(note.nonce).to.equal(note2.nonce);
    expect(note.value).to.equal(note2.value);
  });

  it("Test asset and id encoding with small id", async () => {
    // small id
    const asset = "0x123";
    const id = 1n;
    const encodedAssetBits = encodeAsset(asset, id)
      .toString(2)
      .padStart(256, "0");
    const encodedIDBits = encodeID(id).toString(2).padStart(256, "0");

    // bit length should be 256 after padding. if it's not, then the encoding is too long
    expect(encodedAssetBits.length).to.equal(256);
    expect(encodedIDBits.length).to.equal(256);

    // first 3 bits should be 0
    expect(encodedAssetBits.slice(0, 3)).to.deep.equal("000");
    // next 3 bits should be first 3 bits of id, which should be 000 in this case
    expect(encodedAssetBits.slice(3, 6)).to.deep.equal("000");

    // last 160 bits should be asset
    expect(BigInt(`0b${encodedAssetBits.slice(96)}`)).to.equal(BigInt(asset));

    // first 3 bits should be 0
    expect(encodedIDBits.slice(0, 3)).to.deep.equal("000");
    // last 253 bits should be last 253 bits of id
    expect(BigInt(`0b${encodedIDBits.slice(3)}`)).to.equal(id);
  });

  it("Test asset and id encoding with big id", async () => {
    // small id
    const asset = "0x123";
    const id = 2n ** 256n - 1n;
    const idBits = id.toString(2).padStart(256, "0");
    const encodedAssetBits = encodeAsset(asset, id)
      .toString(2)
      .padStart(256, "0");
    const encodedIDBits = encodeID(id).toString(2).padStart(256, "0");

    // bit length should be 256 after padding. if it's not, then the encoding is too long
    expect(encodedAssetBits.length).to.equal(256);
    expect(encodedIDBits.length).to.equal(256);

    // first 3 bits should be 0
    expect(encodedAssetBits.slice(0, 3)).to.deep.equal("000");
    // next 3 bits should be first 3 bits of id, which should be 111 in this case
    expect(encodedAssetBits.slice(3, 6)).to.deep.equal("111");
    expect(BigInt(`0b${encodedAssetBits.slice(96)}`)).to.equal(BigInt(asset));

    // first 3 bits should be 0
    expect(encodedIDBits.slice(0, 3)).to.deep.equal("000");
    // last 253 bits should be last 253 bits of id
    expect(BigInt(`0b${encodedIDBits.slice(3)}`)).to.equal(
      BigInt(`0b${idBits.slice(3)}`)
    );
  });
});
