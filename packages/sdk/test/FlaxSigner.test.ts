import "mocha";
import { expect } from "chai";
import { Signer } from "../src/sdk/signer";
import { PrivKey } from "../src/crypto/privkey";
import { AnonAddress } from "../src/crypto/address";

describe("Signer", () => {
  it("View key should work", () => {
    const priv1 = PrivKey.genPriv();
    const signer1 = new Signer(priv1);
    const priv2 = PrivKey.genPriv();
    const signer2 = new Signer(priv2);
    expect(signer1.testOwn(signer1.address)).to.equal(true);
    expect(signer1.testOwn(signer2.address)).to.equal(false);
    expect(signer2.testOwn(signer2.address)).to.equal(true);
    expect(signer2.testOwn(signer1.address)).to.equal(false);
  });

  it("Test rerand", () => {
    const priv1 = PrivKey.genPriv();
    const signer1 = new Signer(priv1);
    const rerandAddr1 = signer1.address.rerand();
    const priv2 = PrivKey.genPriv();
    const signer2 = new Signer(priv2);
    expect(signer1.testOwn(signer1.address)).to.equal(true);
    expect(signer1.testOwn(rerandAddr1)).to.equal(true);
    expect(signer2.testOwn(signer1.address)).to.equal(false);
    expect(signer2.testOwn(rerandAddr1)).to.equal(false);
  });

  it("Test address (de)serialization", () => {
    const priv = PrivKey.genPriv();
    const addr = priv.toAnonAddress();
    const str = addr.toString();
    expect(AnonAddress.parse(str)).to.eql(addr);
  });

  it("Test Sign / verify", () => {
    const priv = PrivKey.genPriv();
    const pk = priv.spendPk();
    const signer = new Signer(priv);
    const m = BigInt(123);
    const sig = signer.sign(m);
    expect(Signer.verify(pk, m, sig)).to.equal(true);
  });
});
