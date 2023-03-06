import "mocha";
import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { randomBigInt, range } from "../src";
import { BabyJubJub } from "@nocturne-xyz/circuit-utils";
import { InMemoryMerkleProver } from "../src/merkleProver/inMemory";

chai.use(chaiAsPromised);

const F = BabyJubJub.BaseField;

const randomBaseFieldElement = () => F.reduce(randomBigInt());

describe("InMemoryMerkleProver", () => {
  it("inserts values one-by-one with consecutive indices", async () => {
    const prover = new InMemoryMerkleProver();
    for (const idx of range(10)) {
      await prover.insert(idx, randomBaseFieldElement());
    }

    expect(await prover.count()).to.equal(10);
  });

  it("throws error when inserting non-monotonically increasing indices", async () => {
    const prover = new InMemoryMerkleProver();
    await prover.insert(0, randomBaseFieldElement());
    await prover.insert(2, randomBaseFieldElement());
    expect(prover.insert(1, randomBaseFieldElement())).to.be.rejected;
  });

  it("fills gaps with zeros when inserting non-consecutive indices", async () => {
    const prover = new InMemoryMerkleProver();

    await prover.insert(16, randomBaseFieldElement());
    expect(await prover.count()).to.equal(17);
  });
});
