import "mocha";
import { expect } from "chai";
import { NocturneSigner } from "../src/sdk/signer";
import { NocturnePrivKey } from "../src/crypto/privkey";
import { NocturneAddress } from "../src/crypto/address";
import { Note } from "../src/sdk/note";

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
    const rerandAddr1 = signer1.address.rerand();
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
    const str = addr.toString();
    expect(NocturneAddress.parse(str)).to.eql(addr);
  });

  it("Test Sign / verify", () => {
    const priv = NocturnePrivKey.genPriv();
    const pk = priv.spendPk();
    const signer = new NocturneSigner(priv);
    const m = BigInt(123);
    const sig = signer.sign(m);
    expect(NocturneSigner.verify(pk, m, sig)).to.equal(true);
  });

  it("Test note encryption and decryption", () => {
    const priv = NocturnePrivKey.genPriv();
    const signer = new NocturneSigner(priv);
    const targets = [priv.toCanonAddress()];
    const note = new Note({
      owner: priv.toAddress().toStruct(),
      nonce: 55n,
      asset: '0x12345',
      id: 1n,
      value: 33n
    });
    const [, [encappedKey], encryptedNonce, encryptedValue] = signer.encryptNote(targets, note);
    const [nonce, value] = signer.decryptNote(
      encappedKey, encryptedNonce, encryptedValue
    );
    expect(nonce).to.equal(55n);
    expect(value).to.equal(33n);
  });
});
