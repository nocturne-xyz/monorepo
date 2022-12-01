import "mocha";
import { expect } from "chai";
import { NocturneSigner } from "../src/sdk/signer";
import { NocturnePrivKey } from "../src/crypto/privkey";
import {
  nocturneAddressFromString,
  nocturneAddressToString,
  rerandNocturneAddress,
} from "../src/crypto/address";

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
    const rerandAddr1 = rerandNocturneAddress(signer1.address);
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
    const str = nocturneAddressToString(addr);
    expect(nocturneAddressFromString(str)).to.eql(addr);
  });

  it("Test Sign / verify", () => {
    const priv = NocturnePrivKey.genPriv();
    const pk = priv.spendPk();
    const signer = new NocturneSigner(priv);
    const m = BigInt(123);
    const sig = signer.sign(m);
    expect(NocturneSigner.verify(pk, m, sig)).to.equal(true);
  });
});
