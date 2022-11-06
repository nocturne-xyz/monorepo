pragma circom 2.0.0;

include "include/poseidon.circom";
include "include/bitify.circom";
include "include/sha256/sha256.circom";

include "tree.circom";

// Update a subtree of depth s, with overall tree is of depth r + s
template SubtreeUpdate(r, s) {
    // Public signals

    // r bits encodes the subTreelocation, 3 bits encode the high bit of accumulatorHash
    signal input compressedPathAndHash;

    signal input accumulatorHash;
    signal output oldRoot;
    signal output newRoot;

    // Merkle include witness for the subtre
    signal input siblings[r];
    // Leaves to be inserted
    signal input leaves[2**s];

    // Opening up compressed path
    component path = Num2Bits(r+3);
    path.in <== compressedPathAndHash;

    // Merkle tree inclusion proof for old subtree
    // TODO compute and fill-in the right empty subtreeroot
    var emptySubtreeRoot = 0;
    component inclusionProof = MerkleTreeInclusionProof(r);
    inclusionProof.leaf <== emptySubtreeRoot;
    for (var i = 0; i < r; i++) {
        inclusionProof.siblings[i] <== siblings[i];
        inclusionProof.pathIndices[i] <== path.out[i];
    }
    oldRoot <== inclusionProof.root;

    // Compute accumulator hash for proposed leaves
    component hasher[2**s];
    component leavesToBits[2**s];
    for (var i = 0; i < 2**s; i++) {
        hasher[i] = Sha256(512);
        if (i == 0) {
          for (var j = 0; j < 256; j++) {
            hasher[i].in[j] <== 0;
          }
        } else {
          for (var j = 0; j < 256; j++) {
            hasher[i].in[j] <== hasher[i-1].out[j];
          }
        }
        leavesToBits[i] = Num2Bits(254);
        leavesToBits[i].in <== leaves[i];
        for (var j = 0; j < 254; j++) {
          hasher[i].in[256+j] <== leavesToBits[i].out[j];
        }
        // Pad the leftover two bits with 0
        hasher[i].in[510] <== 0;
        hasher[i].in[511] <== 0;
    }

    // Assert that the accumulatorHash is correct
    component hashBits = Num2Bits(253);
    hashBits.in <== accumulatorHash;
    for (var i = 0; i < 256; i++) {
        if (i < 3) {
            path.out[i] === hasher[2**s-1].out[i];
        }
        else {
            hashBits.out[i-3] === hasher[2**s-1].out[i];
        }
    }

    // Compute subtree root
    signal nodes[s+1][2**s];
    for (var i = 0; i < 2**s; i++) {
        nodes[s][i] <== leaves[i];
    }

    component pHash[s+1][2**(s-1)];
    for (var i = s; i > 0; i--) {
      for (var j = 0; j < 2**(i-1); j++) {
        pHash[i][j] = Poseidon(2);
        pHash[i][j].inputs[0] <== nodes[i][2*j];
        pHash[i][j].inputs[1] <== nodes[i][2*j+1];
        nodes[i-1][j] <== pHash[i][j].out;
      }
    }

    // Merkle tree inclusion proof for old subtree
    component inclusionProof2 = MerkleTreeInclusionProof(r);
    inclusionProof2.leaf <== nodes[0][0];
    for (var i = 0; i < r; i++) {
        inclusionProof2.siblings[i] <== siblings[i];
        inclusionProof2.pathIndices[i] <== path.out[i];
    }
    newRoot <== inclusionProof2.root;
}

component main { public [compressedPathAndHash, accumulatorHash] } = SubtreeUpdate(28, 4);
