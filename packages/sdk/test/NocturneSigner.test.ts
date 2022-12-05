import "mocha";
import { expect } from "chai";
import { NocturneSigner } from "../src/sdk/signer";
import { NocturnePrivKey } from "../src/crypto/privkey";
import { NocturneAddressTrait } from "../src/crypto/address";
import { genNoteTransmission } from "../src/crypto/utils";

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
    const rerandAddr1 = NocturneAddressTrait.rerandNocturneAddress(
      signer1.address
    );
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
    const str = NocturneAddressTrait.nocturneAddressToString(addr);
    expect(NocturneAddressTrait.nocturneAddressFromString(str)).to.eql(addr);
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
});
