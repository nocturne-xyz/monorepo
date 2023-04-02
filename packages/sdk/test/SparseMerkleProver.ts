import "mocha";
import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { InMemoryKVStore, randomBigInt, range } from "../src";
import { BabyJubJub } from "@nocturne-xyz/circuit-utils";
import {
  MAX_DEPTH,
  SparseMerkleProver,
  TreeNode,
} from "../src/SparseMerkleProver";

chai.use(chaiAsPromised);

const F = BabyJubJub.BaseField;

const randomBaseFieldElement = () => F.reduce(randomBigInt());

describe("SparseMerkleProver", () => {
  it("inserts values one-by-one with consecutive indices", () => {
    const kv = new InMemoryKVStore();
    const prover = new SparseMerkleProver(kv);

    for (const idx of range(10)) {
      prover.insert(idx, randomBaseFieldElement());
    }

    expect(prover.count()).to.equal(10);
  });

  it("throws error when inserting non-monotonically increasing indices", () => {
    const kv = new InMemoryKVStore();
    const prover = new SparseMerkleProver(kv);

    prover.insert(0, randomBaseFieldElement());
    prover.insert(2, randomBaseFieldElement());
    expect(() => prover.insert(1, randomBaseFieldElement())).to.throw;
  });

  it("fills gaps with zeros when inserting non-consecutive indices", () => {
    const kv = new InMemoryKVStore();
    const prover = new SparseMerkleProver(kv);

    prover.insert(16, randomBaseFieldElement());
    expect(prover.count()).to.equal(17);
  });

  it("generates valid merkle proofs", () => {
    const kv = new InMemoryKVStore();
    const prover = new SparseMerkleProver(kv);

    // insert a few leaves
    for (const idx of range(10)) {
      prover.insert(idx, randomBaseFieldElement());
    }

    // generate a proof for each leaf

    for (const idx of range(10)) {
      const proof = prover.getProof(idx);
      expect(SparseMerkleProver.verifyProof(proof)).to.be.true;
    }
  });

  it("rejects invalid proofs", () => {
    const kv = new InMemoryKVStore();
    const prover = new SparseMerkleProver(kv);

    // insert a few leaves
    for (const idx of range(10)) {
      prover.insert(idx, randomBaseFieldElement());
    }

    // check that it fails when leaf is wrong
    for (const idx of range(10)) {
      const proof = prover.getProof(idx);

      proof.leaf = randomBaseFieldElement();
      expect(SparseMerkleProver.verifyProof(proof)).to.be.false;
    }

    // check that it fails when the root is wrong
    for (const idx of range(10)) {
      const proof = prover.getProof(idx);

      proof.root = randomBaseFieldElement();
      expect(SparseMerkleProver.verifyProof(proof)).to.be.false;
    }

    // check that it fails when the path is wrong
    for (const idx of range(10)) {
      const proof = prover.getProof(idx);

      proof.pathIndices[0] = 1 - proof.pathIndices[0];
      expect(SparseMerkleProver.verifyProof(proof)).to.be.false;
    }

    // check that it fails when siblings are wrong
    for (const idx of range(10)) {
      const proof = prover.getProof(idx);

      proof.siblings[0] = randomBaseFieldElement();
      expect(SparseMerkleProver.verifyProof(proof)).to.be.false;
    }
  });

  it("prunes nodes irrelevant for proving membership of leaves inserted with `include = false`", () => {
    const kv = new InMemoryKVStore();
    const prover = new SparseMerkleProver(kv);

    // insert a leaf with `include = true`
    prover.insert(0, randomBaseFieldElement(), true);

    // insert 100 leaves with `include = false`
    for (const idx of range(prover.count(), prover.count() + 10)) {
      prover.insert(idx, randomBaseFieldElement(), false);
    }

    // insert a few leaves with `include = true`
    for (const idx of range(prover.count(), prover.count() + 4)) {
      prover.insert(idx, randomBaseFieldElement(), true);
    }

    // insert another few hundred leaves with `include = false`
    for (const idx of range(prover.count(), prover.count() + 30)) {
      prover.insert(idx, randomBaseFieldElement(), false);
    }

    // insert a few leaves with `include = true`
    for (const idx of range(prover.count(), prover.count() + 3)) {
      prover.insert(idx, randomBaseFieldElement(), true);
    }

    const AMOUNT_INSERTED = 1 + 10 + 4 + 30 + 3;

    // expect count to include all leaves
    expect(prover.count()).to.equal(AMOUNT_INSERTED);

    // expect `leaves` map to only include leaves inserted with `include = true`
    // @ts-ignore
    expect(prover.leaves.size).to.equal(1 + 4 + 3);

    // prune
    prover.prune();

    const numLeaves = countLeaves(prover);
    expect(numLeaves).to.equal(expctedNumNonPrunableLeaves(prover));
  });

  it("doesn't prune the latest leaf the tree has an odd number of nodes", () => {
    const kv = new InMemoryKVStore();
    const prover = new SparseMerkleProver(kv);

    // insert one leaf with `include = true`
    prover.insert(0, randomBaseFieldElement(), true);

    // insert an even number of leaves with `include = false`
    for (const idx of range(prover.count(), prover.count() + 20)) {
      prover.insert(idx, randomBaseFieldElement(), false);
    }

    // insert one more leaf with `include = false`.
    // This leaf's index will be even and the tree will have an odd number of leaves
    // This leaf should not be pruned because, if we were to prune it and then insert a new leaf,
    // we would no longer have the sibling of the leaf we just inserted.
    prover.insert(prover.count(), randomBaseFieldElement(), false);

    // prune
    prover.prune();

    const numLeaves = countLeaves(prover);
    expect(numLeaves).to.equal(expctedNumNonPrunableLeaves(prover));
  });

  it("inserts a batch of leaves all at once", () => {
    const kv = new InMemoryKVStore();
    const p1 = new SparseMerkleProver(kv);
    const p2 = new SparseMerkleProver(kv);

    // insert 400 random leaves
    const leaves = range(100).map(() => randomBaseFieldElement());

    for (const [idx, leaf] of leaves.entries()) {
      p1.insert(idx, leaf);
    }

    p2.insertBatch(
      0,
      leaves,
      range(100).map(() => true)
    );

    // expect the roots to be equal
    //@ts-ignore
    expect(p1.root.hash).to.equal(p2.root.hash);

    // expect structures to be identitcal
    //@ts-ignore
    expect(p1.root).to.deep.equal(p2.root);
  });
});

function countLeaves(prover: SparseMerkleProver): number {
  // do an inorder traversal of the tree to count the number of leaves
  let numLeaves = 0;
  const traverse = (node: TreeNode, depth: number) => {
    if (depth === MAX_DEPTH) {
      numLeaves++;
      return;
    }

    if (node.left) {
      traverse(node.left, depth + 1);
    }

    if (node.right) {
      traverse(node.right, depth + 1);
    }
  };

  // @ts-ignore
  traverse(prover.root, 0);

  return numLeaves;
}

function expctedNumNonPrunableLeaves(prover: SparseMerkleProver): number {
  // number of leaves should be equal to the number of leaves in the `leaves` map
  // plus the number of leaves not in the `leaves` map that are siblings of leaves in the `leaves` map
  // plus one if the latest leaf's index is odd and it's not in the `leaves` map

  // @ts-ignore
  const numSiblingLeaves = Array.from(prover.leaves.keys()).filter(
    (idx) => !prover.leaves.has(idx ^ 1)
  ).length;

  // @ts-ignore
  const includedLeaves = prover.leaves.size;

  // @ts-ignore
  const additionalLeaf =
    prover.count() % 2 === 1 && !prover.leaves.has(prover.count() - 1) ? 1 : 0;

  return includedLeaves + numSiblingLeaves + additionalLeaf;
}
