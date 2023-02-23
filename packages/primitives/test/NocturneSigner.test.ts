import "mocha";
import { expect } from "chai";
import { NocturneSigner, generateRandomSpendingKey } from "../src/crypto";

describe("NocturneSigner", () => {
  it("can sign sign / verify messages", () => {
    const sk = generateRandomSpendingKey();
    const signer = new NocturneSigner(sk);
    const pk = signer.spendPk;
    const m = 123n;
    const sig = signer.sign(m);
    expect(NocturneSigner.verify(pk, m, sig)).to.equal(true);
  });
});
