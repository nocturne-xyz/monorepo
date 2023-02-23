import "mocha";
import { expect } from "chai";
import { NocturneViewer, encryptNote } from "../src/crypto";
import { AssetType } from "../src";
import { generateRandomViewingKey } from "./utils";

describe("NocturneViewer", () => {
  it("can generate and link its own stealth addresses", () => {
    const vk1 = generateRandomViewingKey();
    const vk2 = generateRandomViewingKey();
    const viewer1 = new NocturneViewer(vk1);
    const viewer2 = new NocturneViewer(vk2);

    expect(
      viewer1.isOwnAddress(viewer1.generateRandomStealthAddress())
    ).to.equal(true);
    expect(
      viewer1.isOwnAddress(viewer2.generateRandomStealthAddress())
    ).to.equal(false);
    expect(
      viewer2.isOwnAddress(viewer2.generateRandomStealthAddress())
    ).to.equal(true);
    expect(
      viewer2.isOwnAddress(viewer1.generateRandomStealthAddress())
    ).to.equal(false);
  });

  it("can decrypt encrypted notes it owns", () => {
    const vk = generateRandomViewingKey();
    const viewer = new NocturneViewer(vk);
    const addr = viewer.canonicalAddress();
    const asset = {
      assetType: AssetType.ERC20,
      assetAddr: "0x123",
      id: 1n,
    };
    const note = {
      owner: viewer.generateRandomStealthAddress(),
      nonce: 33n,
      value: 55n,
      asset,
    };
    const encryptedNote = encryptNote(addr, note);
    const note2 = viewer.getNoteFromEncryptedNote(encryptedNote, 2, asset);
    expect(note.nonce).to.equal(note2.nonce);
    expect(note.value).to.equal(note2.value);
  });
});
