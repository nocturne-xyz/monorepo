import "mocha";
import { expect } from "chai";
import { FlaxSigner } from "../signer";
import { FlaxPrivKey } from "./privkey";
import { FlaxAddress, rerandAddr } from "./address";

describe("[crypto]", () => {
  it("View key should work", () => {
    const priv1 = FlaxPrivKey.genPriv();
    const signer1 = new FlaxSigner(priv1);
    const priv2 = FlaxPrivKey.genPriv();
    const signer2 = new FlaxSigner(priv2);
    expect(signer1.testOwn(signer1.address)).to.equal(true);
    expect(signer1.testOwn(signer2.address)).to.equal(false);
    expect(signer2.testOwn(signer2.address)).to.equal(true);
    expect(signer2.testOwn(signer1.address)).to.equal(false);
  });

  it("Test rerand", () => {
    const priv1 = FlaxPrivKey.genPriv();
    const signer1 = new FlaxSigner(priv1);
    const rerandAddr1 = rerandAddr(signer1.address);
    const priv2 = FlaxPrivKey.genPriv();
    const signer2 = new FlaxSigner(priv2);
    expect(signer1.testOwn(signer1.address)).to.equal(true);
    expect(signer1.testOwn(rerandAddr1)).to.equal(true);
    expect(signer2.testOwn(signer1.address)).to.equal(false);
    expect(signer2.testOwn(rerandAddr1)).to.equal(false);
  });

  it("Test address (de)serialization", () => {
    const priv = FlaxPrivKey.genPriv();
    const addr = priv.toAddress();
    const str = addr.toString();
    expect(FlaxAddress.parse(str)).to.eql(addr);
  });

  it("Test Sign / verify", () => {
    const priv = FlaxPrivKey.genPriv();
    const pk = priv.spendPk();
    const signer = new FlaxSigner(priv);
    const m = BigInt(123);
    const sig = signer.sign(m);
    expect(FlaxSigner.verify(pk, m, sig)).to.equal(true);
  });
});
