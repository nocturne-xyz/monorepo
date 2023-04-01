import "mocha";
import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { InMemoryKVStore, randomBigInt, range } from "../src";
import { BabyJubJub } from "@nocturne-xyz/circuit-utils";
import { MAX_DEPTH, SparseMerkleProver, TreeNode } from "../src/SparseMerkleProver";

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


    let startTime = Date.now();
    // insert a leaf with `include = true`
    prover.insert(0, randomBaseFieldElement(), true);

    // insert 100 leaves with `include = false`
    for (const idx of range(prover.count(), prover.count() + 100)) {
      prover.insert(idx, randomBaseFieldElement(), false);
    }

    // insert a few leaves with `include = true`
    for (const idx of range(prover.count(), prover.count() + 4)) {
      prover.insert(idx, randomBaseFieldElement(), true);
    }

    // insert another few hundred leaves with `include = false`
    for (const idx of range(prover.count(), prover.count() + 300)) {
      prover.insert(idx, randomBaseFieldElement(), false);
    }

    // insert a few leaves with `include = true`
    for (const idx of range(prover.count(), prover.count() + 3)) {
      prover.insert(idx, randomBaseFieldElement(), true);
    }

    const AMOUNT_INSERTED = 1 + 100 + 4 + 300 + 3;
    console.log(`took ${Date.now() - startTime}ms to insert ${AMOUNT_INSERTED} leaves`);

    // expect count to include all leaves
    expect(prover.count()).to.equal(AMOUNT_INSERTED);

    // expect `leaves` map to only include leaves inserted with `include = true`
    // @ts-ignore
    expect(prover.leaves.size).to.equal(1 + 4 + 3);

    // prune
    startTime = Date.now();
    prover.prune();
    console.log(`took ${Date.now() - startTime}ms to prune`);

    // do an inorder traversal of the tree to check the number of leaves
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
    }

    startTime = Date.now();
    // @ts-ignore
    traverse(prover.root, 0);
    console.log(`took ${Date.now() - startTime}ms to traverse tree`);

    // expect number of leaves to be equal to the number of leaves in the `leaves` map
    // @ts-ignore
    expect(numLeaves).to.equal(prover.leaves.size);
  })
});
