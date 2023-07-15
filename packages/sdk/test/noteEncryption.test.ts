import "mocha";
import { expect } from "chai";
import {
  Asset,
  AssetTrait,
  NocturneViewer,
  Note,
  NoteTrait,
  encryptNote,
  randomFr,
  range,
} from "../src";
import randomBytes from "randombytes";
import { decryptNote } from "../src/crypto/noteEncryption";
import { ethers } from "ethers";

describe("note serialization", () => {
  it("can sereialize and deserialize notes", () => {
    const vk = randomFr();
    const viewer = new NocturneViewer(vk, 1n);
    range(30).forEach(() => {
      const note = randomNote(viewer);

      const serialized = NoteTrait.serializeCompact(note);
      const deserialized = NoteTrait.deserializeCompact(serialized);

      expect(note).to.eql(deserialized);
    });
  });
});

describe("note encryption", () => {
  it("can encrypt and decrypt notes", () => {
    const vk = randomFr();
    const viewer = new NocturneViewer(vk, 1n);
    const sender = viewer.canonicalAddress();
    range(10).forEach(() => {
      const note = randomNote(viewer);
      const noteWithSender = { ...note, sender };
      const encrypted = encryptNote(viewer.canonicalAddress(), noteWithSender);
      const decrypted = decryptNote(vk, encrypted);

      expect(noteWithSender).to.eql(decrypted);
    });
  });
});

function randomNote(viewer: NocturneViewer): Note {
  const owner = viewer.generateRandomStealthAddress();
  const nonce = randomFr();
  const asset = randomAsset();
  const value = randomFr();

  return { owner, nonce, asset, value };
}

function randomAsset(): Asset {
  const assetAddr = ethers.utils.getAddress(
    "0x" + randomBytes(20).toString("hex")
  );
  const assetType = AssetTrait.parseAssetType((randomFr() % 3n).toString());
  const id = randomFr();

  return { assetType, assetAddr, id };
}
