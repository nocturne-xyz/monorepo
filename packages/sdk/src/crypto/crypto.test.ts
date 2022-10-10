import {
  genPriv,
  privToAddr,
  testOwn,
  sign,
  verify,
  rerandAddr,
  addrToString,
  parseAddr,
} from "./crypto";

describe("[crypto]", () => {
  test("View key should work", () => {
    const priv = genPriv();
    const addr = privToAddr(priv);
    const priv2 = genPriv();
    expect(testOwn(priv, addr)).toEqual(true);
    expect(testOwn(priv2, addr)).toEqual(false);
  });

  test("Test rerand", () => {
    const priv = genPriv();
    const addr = privToAddr(priv);
    const addr2 = rerandAddr(addr);
    const priv2 = genPriv();
    expect(testOwn(priv, addr)).toEqual(true);
    expect(testOwn(priv, addr2)).toEqual(true);
    expect(testOwn(priv2, addr)).toEqual(false);
    expect(testOwn(priv2, addr2)).toEqual(false);
  });

  test("Test address (de)serielization", () => {
    const priv = genPriv();
    const addr = privToAddr(priv);
    const str = addrToString(addr);
    expect(parseAddr(str)).toEqual(addr);
  });

  test("Test Sign / verify", () => {
    const priv = genPriv();
    const addr = privToAddr(priv);
    const m = BigInt(123);
    const sig = sign(priv, addr, m);
    expect(verify(addr, m, sig)).toEqual(true);
  });
});
