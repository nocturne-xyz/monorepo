import "mocha";
import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { InMemoryKVStore, randomBigInt, range } from "../src";
import { BabyJubJub } from "@nocturne-xyz/circuit-utils";
import {
  ARITY,
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

      proof.pathIndices[0] = 3 - proof.pathIndices[0];
      expect(SparseMerkleProver.verifyProof(proof)).to.be.false;
    }

    // check that it fails when siblings are wrong
    for (const idx of range(10)) {
      const proof = prover.getProof(idx);

      proof.siblings[0] = [
        randomBaseFieldElement(),
        randomBaseFieldElement(),
        randomBaseFieldElement(),
      ];
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

  // run the test for each k mod ARITY
  for (const k of range(1, ARITY)) {
    it(`doesn't prune the latest leaves if the tree has a number of nodes = ${k} mod ARITY (${ARITY})`, () => {
      // run the test for each k mod ARITY
      const kv = new InMemoryKVStore();
      const prover = new SparseMerkleProver(kv);

      // insert one leaf with `include = true`
      prover.insert(0, randomBaseFieldElement(), true);

      // insert an multiple of ARITY number of leaves with `include = false`
      for (const idx of range(prover.count(), prover.count() + ARITY * 10)) {
        prover.insert(idx, randomBaseFieldElement(), false);
      }

      // insert k more leaves with `include = false` into a copy.
      // These leaves should not be pruned because, if we were to prune it and then insert a new leaf,
      // we'd be missing at least one sibling of the leaf we just inserted.
      for (const _ of range(k)) {
        prover.insert(prover.count(), randomBaseFieldElement(), false);
      }

      // prune
      prover.prune();

      const numLeaves = countLeaves(prover);
      expect(numLeaves).to.equal(expctedNumNonPrunableLeaves(prover));
    });
  }

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

  it("marks leaves for pruning", () => {
    const kv = new InMemoryKVStore();
    const prover = new SparseMerkleProver(kv);

    // insert a bunch of leaves with `include = false`
    prover.insertBatch(
      0,
      range(100).map(randomBaseFieldElement),
      range(100).map(() => false)
    );

    // insert a few leaves with `include = true`
    prover.insertBatch(
      100,
      range(10).map(randomBaseFieldElement),
      range(10).map(() => true)
    );

    // insert another bunch of leaves with `include = false`
    prover.insertBatch(
      110,
      range(100).map(randomBaseFieldElement),
      range(100).map(() => false)
    );

    // prune
    prover.prune();

    // mark 103rd leaf for pruning
    prover.markForPruning(103);

    // prune again
    prover.prune();

    // check number of leaves
    const numLeaves = countLeaves(prover);
    expect(numLeaves).to.equal(expctedNumNonPrunableLeaves(prover));
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

    for (const child of node.children) {
      if (child) {
        traverse(child, depth + 1);
      }
    }
  };

  // @ts-ignore
  traverse(prover.root, 0);

  return numLeaves;
}

function expctedNumNonPrunableLeaves(prover: SparseMerkleProver): number {
  // number of leaves should be equal to the number of leaves in the `leaves` map
  // plus the number of leaves not in the `leaves` map that are siblings of leaves in the `leaves` map
  // plus 0-ARITY more to account the for the following edge case:
  //   If tree count is not a multiple of `ARITY`, then we need to keep the rightmost group of `ARITY` leaves in the tree
  //   even if they're not in the `leaves` map. To illustrate why, consider the following example:a
  //
  //   suppose tree count is 2 mod ARITY - that means the rightmost part of the tree will have a branch with
  //   two leaves on the left and the rest of the leaves empty. Now suppose those two leaves aren't in the `leaves` map.
  //   If we were to prune them, insert another leaf, with the new leaf included in the leaves map,
  //   we'd now need the two leaves we just pruned, since they're siblings of a leaf in the `leaves` map.
  //
  //   To account for this edge case, we add prover.count % ARITY to the result if none of the leaves in this
  //   "unifinished" group of ARITY leaves are in the `leaves` map.
  //    If at least one of them is in the map, then we've already accounted for it because it's a
  //    sibling of a leaf in the `leaves` map

  // get number of leaves in the leaves map
  // @ts-ignore
  const includedLeaves = prover.leaves.size;

  // get number of leaves that aren't in the leaves map but have a sibling that is
  const siblingIndices = new Set();
  // @ts-ignore
  for (const leafIdx of prover.leaves.keys()) {
    // siblings of `leafIdx` have indices the same as `leafIdx` but with any of the bottom `log2(ARITY)` bits flipped
    for (const siblingIndex of range(1, ARITY).map((i) => leafIdx ^ i)) {
      // @ts-ignore
      if (!prover.leaves.has(siblingIndex)) {
        siblingIndices.add(siblingIndex);
      }
    }
  }

  let res = includedLeaves + siblingIndices.size;

  // account for special case
  const k = prover.count() % ARITY;
  //@ts-ignore
  const needsAdditionalLeaves =
    k > 0 && range(k).every((i) => !prover.leaves.has(prover.count - k + i));
  if (needsAdditionalLeaves) {
    res += k;
  }

  return res;
}
