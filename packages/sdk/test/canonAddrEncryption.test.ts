import "mocha";
import { expect } from "chai";
import { NocturneViewer, randomFr, range } from "../src";

describe("canonical address encryption / decryption", () => {
  it("can encrypt and decrypt a canonical address", () => {
    range(30).forEach(() => {
      const senderVk = randomFr();
      const sender = new NocturneViewer(senderVk, 1n);
      const senderCanonAddr = sender.canonicalAddress();

      const receiverVk = randomFr();
      const receiver = new NocturneViewer(receiverVk, 1n);
      const receiverCanonAddr = receiver.canonicalAddress();

      const nonce = randomFr();
      const ciphertext = sender.encryptCanonAddrToReceiver(
        receiverCanonAddr,
        nonce
      );
      const plaintext = receiver.decryptCanonAddr(ciphertext);

      expect(plaintext).to.eql(senderCanonAddr);
    });
  });
});
