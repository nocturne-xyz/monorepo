import { genPriv, privToAddr, testOwn, sign, verify, rerandAddr, addrToString, parseAddr } from "./crypto";

describe("[crypto]", () => {
  test("View key should work", () => {
    let priv = genPriv();
    let addr = privToAddr(priv);
    let priv2 = genPriv();
    expect(testOwn(priv, addr)).toEqual(true);
    expect(testOwn(priv2, addr)).toEqual(false);
  });

  test("Test rerand", () => {
    let priv = genPriv();
    let addr = privToAddr(priv);
    let addr2 = rerandAddr(addr);
    let priv2 = genPriv();
    expect(testOwn(priv, addr)).toEqual(true);
    expect(testOwn(priv2, addr)).toEqual(false);
  });

  test("Test address (de)serielization", () => {
    let priv = genPriv();
    let addr = privToAddr(priv);
    let str = addrToString(addr);
    expect(parseAddr(str)).toEqual(addr);
  });

  test("Test Sign / verify", () => {
    let priv = genPriv();
    let addr = privToAddr(priv);
    let m = BigInt(123);
    let sig = sign(priv, addr, m);
    expect(verify(addr, m, sig)).toEqual(true);
  });

});
