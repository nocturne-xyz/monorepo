import { privToPub, genPriv } from "./babyjub-utils";
import { bytesToHex, hexToBytes } from "../utils";

describe("[bayjub utils]", () => {
  const privKey =
    "0x28156abe7fe2fd433dc9df969286b96666489bac508612d0e16593e944c4f69f";
  const privKeyBuff = hexToBytes(privKey);

  test("Generate public key uncompressed", () => {
    const pubKey = privToPub(privKeyBuff, false);
    expect(bytesToHex(pubKey)).toEqual(
      "0x270000b73fba5f79c0491a32d4e64f69813db369ea106c09bc5ca4ae220cbb81" +
        "2d9e82263b94a343ee95d56c810a5a0adb63a439cd5b4944dfb56f09e28c6f04"
    );
  });

  test("Generate public key compressed", () => {
    const pubKeyCompressed = privToPub(privKeyBuff, true);
    expect(bytesToHex(pubKeyCompressed)).toEqual(
      "0xad9e82263b94a343ee95d56c810a5a0adb63a439cd5b4944dfb56f09e28c6f04"
    );
  });

  test("Generate public key from private key different than 32 bytes", () => {
    const privKey31 = Buffer.alloc(31).fill("A");
    const privKey33 = Buffer.alloc(33).fill("B");
    expect(() => {
      privToPub(privKey31, true);
    }).toThrow("Input Error: Buffer has 31 bytes. It should be 32 bytes");
    expect(() => {
      privToPub(privKey33, true);
    }).toThrow("Input Error: Buffer has 33 bytes. It should be 32 bytes");
  });

  test("Generate random private key, retrieve public", () => {
    const randPrivKeyHex = genPriv();
    const randPrivKeyBuff = hexToBytes(randPrivKeyHex);
    expect(() => {
      privToPub(randPrivKeyBuff, true);
    }).not.toThrow();
  });
});
