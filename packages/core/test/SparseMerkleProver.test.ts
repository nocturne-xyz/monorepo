import "mocha";
import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import {
  NoteTrait,
  bigInt256ToFieldElems,
  bigintToBEPadded,
  range,
  TreeConstants,
  NocturneSigner,
  StealthAddressTrait,
} from "../src";
import { BabyJubJub, poseidon4 } from "@nocturne-xyz/crypto";
import { SparseMerkleProver, TreeNode } from "../src/SparseMerkleProver";
import {
  HashFunction,
  IncrementalMerkleTree,
} from "@zk-kit/incremental-merkle-tree";
import { sha256 } from "js-sha256";
import { encodePathAndHash } from "../src/proof/subtreeUpdate";
import { DUMMY_ROOT_KEY, randomBigInt } from "./utils";
import { keccak256 } from "ethers/lib/utils";

const { ARITY, ZERO_VALUE, DEPTH } = TreeConstants;

chai.use(chaiAsPromised);

const F = BabyJubJub.BaseField;

const randomBaseFieldElement = () => F.create(randomBigInt());

describe("SparseMerkleProver", () => {
  it("inserts values one-by-one with consecutive indices", () => {
    const prover = new SparseMerkleProver();

    for (const idx of range(10)) {
      prover.insert(idx, randomBaseFieldElement());
    }

    expect(prover.count()).to.equal(10);
  });

  it("throws error when inserting non-monotonically increasing indices", () => {
    const prover = new SparseMerkleProver();

    prover.insert(0, randomBaseFieldElement());
    prover.insert(2, randomBaseFieldElement());
    expect(() => prover.insert(1, randomBaseFieldElement())).to.throw;
  });

  it("fills gaps with zeros when inserting non-consecutive indices", () => {
    const prover = new SparseMerkleProver();

    prover.insert(16, randomBaseFieldElement());
    expect(prover.count()).to.equal(17);
  });

  it("generates valid merkle proofs", () => {
    const prover = new SparseMerkleProver();

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
    const prover = new SparseMerkleProver();

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
    const prover = new SparseMerkleProver();

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
    expect(numLeaves).to.equal(expectedNumNonPrunableLeaves(prover));
  });

  // run the test for each k mod ARITY
  for (const k of range(1, ARITY)) {
    it(`doesn't prune the latest leaves if the tree has a number of nodes = ${k} mod ARITY (${ARITY}) and they're not in the map`, () => {
      // run the test for each k mod ARITY
      const prover = new SparseMerkleProver();

      // insert a multiple of ARITY number of leaves with `include = false`
      for (const idx of range(prover.count(), prover.count() + ARITY * 3)) {
        prover.insert(idx, randomBaseFieldElement(), true);
      }

      // insert k more leaves with `include = false`
      // These leaves should not be pruned because, if we were to prune it and then insert a new leaf,
      // we'd be missing at least one sibling of the leaf we just inserted.
      for (const _ of range(k)) {
        prover.insert(prover.count(), randomBaseFieldElement(), false);
      }

      // prune
      prover.prune();

      const numLeaves = countLeaves(prover);
      expect(numLeaves).to.equal(expectedNumNonPrunableLeaves(prover));
    });
  }

  it(`doesn't prune latest ARITY leaves if the tree has a number of nodes = 0 mod ARITY (${ARITY}) and none of them are in the map`, () => {
    const prover = new SparseMerkleProver();

    // insert an multiple of ARITY number of leaves with `include = false`
    for (const idx of range(prover.count(), prover.count() + ARITY * 3)) {
      prover.insert(idx, randomBaseFieldElement(), false);
    }

    // insert ARITY leaves with `include = true`
    // these leaves should not be pruned
    for (const idx of range(prover.count(), prover.count() + ARITY)) {
      prover.insert(idx, randomBaseFieldElement(), true);
    }

    // prune
    prover.prune();

    const numLeaves = countLeaves(prover);
    expect(numLeaves).to.equal(expectedNumNonPrunableLeaves(prover));
  });

  it("inserts a batch of leaves all at once", () => {
    const p1 = new SparseMerkleProver();
    const p2 = new SparseMerkleProver();

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
    const prover = new SparseMerkleProver();

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
    expect(numLeaves).to.equal(expectedNumNonPrunableLeaves(prover));
  });

  it("calculates same root as @zk-kit/incremental-merkle-tree", () => {
    // check empty batch case
    {
      const prover = new SparseMerkleProver();
      const tree = new IncrementalMerkleTree(
        poseidon4 as HashFunction,
        DEPTH,
        ZERO_VALUE,
        ARITY
      );

      prover.insertBatch(0, [], []);
      expect(prover.getRoot() === tree.root).to.be.true;
    }

    // run 5 fuzzes using incremental insert
    range(5).forEach((_) => {
      const prover = new SparseMerkleProver();
      const tree = new IncrementalMerkleTree(
        poseidon4 as HashFunction,
        DEPTH,
        ZERO_VALUE,
        ARITY
      );

      const numLeaves = Number(randomBigInt() % 30n);
      for (const idx of range(prover.count(), prover.count() + numLeaves)) {
        const leaf = randomBaseFieldElement();
        prover.insert(idx, leaf, false);
        tree.insert(leaf);

        expect(prover.getRoot() === tree.root).to.be.true;
      }
    });

    // run 5 fuzzes using batch insert
    range(5).forEach((_) => {
      const prover = new SparseMerkleProver();
      const tree = new IncrementalMerkleTree(
        poseidon4 as HashFunction,
        DEPTH,
        ZERO_VALUE,
        ARITY
      );

      const numLeaves = Number(randomBigInt() % 100n);
      const batch = range(numLeaves).map(randomBaseFieldElement);
      const includes = new Array(numLeaves).fill(false);

      prover.insertBatch(0, batch, includes);
      for (const leaf of batch) {
        tree.insert(leaf);
      }

      const check = prover.getRoot() === tree.root;
      if (!check) {
        console.log("fuzz failed for batch", batch);
        console.log("sparse: ", prover.getRoot());
        console.log("zk-kit: ", tree.root);
      }

      expect(check).to.be.true;
    });
  });

  it("queues up uncommitted leaves", () => {
    const prover = new SparseMerkleProver();
    const rootBefore = prover.getRoot();

    // insert 10 leaves with `include = true`
    const first10 = range(10).map(randomBaseFieldElement);
    prover.insertBatchUncommitted(
      0,
      first10,
      range(10).map(() => true)
    );

    // insert 10 leaves with `include = false`
    prover.insertBatchUncommitted(
      10,
      range(10).map(randomBaseFieldElement),
      range(10).map(() => false)
    );

    // since they're uncommitted, expect root and count to be the same as empty tree,
    // but totalCount to be 20
    expect(prover.getRoot()).to.equal(rootBefore);
    expect(prover.count()).to.equal(0);
    expect(prover.totalCount()).to.equal(20);

    // commit to the first 10 leaves
    prover.commitUpToIndex(9);

    // expect root to be equivalent to inserting the first 10 leaves directly
    // and count to be 10, nto 20
    const replica = new SparseMerkleProver();
    replica.insertBatch(
      0,
      first10,
      range(10).map(() => true)
    );
    expect(prover.getRoot()).to.equal(replica.getRoot());
    expect(prover.count()).to.equal(10);
  });

  it("returns correct totalCount when there are implicit zeros", () => {
    const prover = new SparseMerkleProver();

    // insert 10 leaves with `include = true`
    prover.insertBatchUncommitted(
      0,
      range(10).map(randomBaseFieldElement),
      range(10).map(() => true)
    );

    // insert 10 leaves with `include = true`, but starting at index 20, leaving a gap of 10 zeros
    prover.insertBatchUncommitted(
      20,
      range(10).map(randomBaseFieldElement),
      range(10).map(() => true)
    );

    // expect totalCount to be 30
    expect(prover.totalCount()).to.equal(30);
  });

  it("enforces monotonicity when committing", () => {
    const prover = new SparseMerkleProver();

    // insert 10 leaves with `include = true`
    const first10 = range(10).map(randomBaseFieldElement);
    prover.insertBatchUncommitted(
      0,
      first10,
      range(10).map(() => true)
    );

    // insert 10 leaves with `include = false`
    prover.insertBatchUncommitted(
      10,
      range(10).map(randomBaseFieldElement),
      range(10).map(() => false)
    );

    // commit to the first 10 leaves
    prover.commitUpToIndex(10);

    // attempt to insert an uncommitted batch starting at index 5
    // we expect it to fail
    expect(() =>
      prover.insertBatchUncommitted(
        5,
        first10,
        range(10).map(() => true)
      )
    ).to.throw;

    // attempt to insert a batch directly into the tree starting at index 5
    // we expect it to fail
    expect(() =>
      prover.insertBatch(
        5,
        first10,
        range(10).map(() => true)
      )
    ).to.throw;
  });

  it.skip("generates test constants for testTreeTest in contracts", () => {
    // from idx 0, insert 420, 69, and print root
    const prover = new SparseMerkleProver();

    prover.insert(0, 420n, false);
    prover.insert(1, 69n, false);

    console.log("root: ", prover.getRoot().toString());

    // from idx 16, insert 9, 1, 1449, and print root
    prover.insert(16, 9n, false);
    prover.insert(17, 1n, false);
    prover.insert(18, 1449n, false);

    console.log("root: ", prover.getRoot().toString());
  });

  it.skip("generates test constants for testCalculatePublicInputs in contracts", () => {
    const prover = new SparseMerkleProver();

    const ownerViewer = new NocturneSigner(Uint8Array.from(DUMMY_ROOT_KEY));
    const owner = ownerViewer.canonicalStealthAddress();
    console.log("uncompressed owner", owner);
    const compressedOwner = StealthAddressTrait.compress(owner);
    console.log("owner:", compressedOwner);

    // copy of what's in packages/contracts/contracts/test/unit/OffchainMerkleTree.t.sol
    const dummyNote = NoteTrait.decode({
      owner,
      nonce: 1n,
      encodedAssetAddr: 917551056842671309452305380979543736893630245704n,
      encodedAssetId: 5n,
      value: 100n,
    });

    const dummyNc = NoteTrait.toCommitment(dummyNote);

    // accumulator hash / path
    {
      // construct a batch with the following sequence:
      // 1 note, 4 notes, 9 ncs, 2 notes
      const batch = [
        dummyNote,
        ...range(4).map(() => dummyNote),
        ...range(9).map(() => dummyNc),
        ...range(2).map(() => dummyNote),
      ];
      const bitmap = [
        ...range(1).map(() => 1n),
        ...range(4).map(() => 1n),
        ...range(9).map(() => 0n),
        ...range(2).map(() => 1n),
      ];

      const accumulatorHashPreimage: number[] = [];
      for (const noteOrCommitment of batch) {
        if (typeof noteOrCommitment === "bigint") {
          accumulatorHashPreimage.push(
            ...bigintToBEPadded(noteOrCommitment, 32)
          );
        } else {
          accumulatorHashPreimage.push(...NoteTrait.sha256(noteOrCommitment));
        }
      }

      const bitmapAsBigint = bitmap.reduce(
        (acc, bit, i) => acc | (bit << (255n - BigInt(i))),
        0n
      );
      accumulatorHashPreimage.push(...bigintToBEPadded(bitmapAsBigint, 32));

      const accumulatorHashU256 = BigInt(
        "0x" + sha256.hex(accumulatorHashPreimage)
      );
      console.log("accumulatorHash", accumulatorHashU256);
      const [accumulatorHashHi, accumulatorHash] =
        bigInt256ToFieldElems(accumulatorHashU256);

      console.log("accumulatorHashHi", accumulatorHashHi);
      console.log("encoded accumulator hash: ", accumulatorHash.toString());

      const encodedPathAndHash = encodePathAndHash(
        BigInt(0),
        accumulatorHashHi
      );
      console.log("encodedPathAndHash: ", encodedPathAndHash);
    }

    // new root
    {
      // insert the commitments into tree
      const batch = new Array(16).fill(dummyNc);
      const includes = new Array(16).fill(true);
      prover.insertBatch(0, batch, includes);

      // print new root
      console.log("new root: ", prover.getRoot().toString());
    }
  });

  it.skip("generates domain separators", () => {
    const hash = keccak256(Buffer.from("SENDER_COMMITMENT"));
    console.log("senderCommitmentDomainSeparator", F.create(BigInt(hash)));
  });
});

function countLeaves(prover: SparseMerkleProver): number {
  // do an inorder traversal of the tree to count the number of leaves
  let numLeaves = 0;
  const traverse = (node: TreeNode, depth: number) => {
    if (depth === DEPTH) {
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

function expectedNumNonPrunableLeaves(prover: SparseMerkleProver): number {
  // number of leaves should be equal to the number of leaves in the `leaves` map
  // plus the number of leaves not in the `leaves` map that are siblings of leaves in the `leaves` map
  // plus the number of leaves in rightmost depth-1 subtree if none of its leaves are in the `leaves` map
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

  // account for rightmost depth-1 subtree edge case
  const rightmostDepthOneSubtreeSize =
    prover.count() % ARITY === 0 ? ARITY : prover.count() % ARITY;
  const needsAdditionalLeaves = range(rightmostDepthOneSubtreeSize).every(
    // @ts-ignore
    (i) => !prover.leaves.has(prover.count() - i - 1)
  );

  if (needsAdditionalLeaves) {
    res += rightmostDepthOneSubtreeSize;
  }

  return res;
}
