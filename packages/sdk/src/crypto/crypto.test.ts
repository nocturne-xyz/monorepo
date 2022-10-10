import {
  FlaxAddress,
  FlaxPrivKey,
  // FlaxAddress,
  FlaxSigner,
  rerandAddr,
} from "./crypto";

describe("[crypto]", () => {
  test("View key should work", () => {
    const priv1 = FlaxPrivKey.genPriv();
    const signer1 = new FlaxSigner(priv1);
    const priv2 = FlaxPrivKey.genPriv();
    const signer2 = new FlaxSigner(priv2);
    expect(signer1.testOwn(signer1.address)).toEqual(true);
    expect(signer1.testOwn(signer2.address)).toEqual(false);
    expect(signer2.testOwn(signer2.address)).toEqual(true);
    expect(signer2.testOwn(signer1.address)).toEqual(false);
  });

  test("Test rerand", () => {
    const priv1 = FlaxPrivKey.genPriv();
    const signer1 = new FlaxSigner(priv1);
    const rerandAddr1 = rerandAddr(signer1.address);
    const priv2 = FlaxPrivKey.genPriv();
    const signer2 = new FlaxSigner(priv2);
    expect(signer1.testOwn(signer1.address)).toEqual(true);
    expect(signer1.testOwn(rerandAddr1)).toEqual(true);
    expect(signer2.testOwn(signer1.address)).toEqual(false);
    expect(signer2.testOwn(rerandAddr1)).toEqual(false);
  });

  test("Test address (de)serialization", () => {
    const priv = FlaxPrivKey.genPriv();
    const addr = priv.toAddress();
    const str = addr.toString();
    expect(FlaxAddress.parse(str)).toEqual(addr);
  });

  test("Test Sign / verify", () => {
    const priv = FlaxPrivKey.genPriv();
    const signer = new FlaxSigner(priv);
    const m = BigInt(123);
    const sig = signer.sign(m);
    expect(FlaxSigner.verify(signer.address, m, sig)).toEqual(true);
  });
});
