import { genPriv, privToAddr, testOwn, sign, verify } from "./crypto";

describe("[crypto]", () => {
  test("View key should work", () => {
    let priv = genPriv();
    let addr = privToAddr(priv);
    let priv2 = genPriv();
    expect(testOwn(priv, addr)).toEqual(true);
    expect(testOwn(priv2, addr)).toEqual(false);
  });

  test("Sign / verify", () => {
    let priv = genPriv();
    let addr = privToAddr(priv);
    let m = BigInt(123);
    let sig = sign(priv, addr, m);
    expect(verify(addr, m, sig)).toEqual(true);
  });

});
