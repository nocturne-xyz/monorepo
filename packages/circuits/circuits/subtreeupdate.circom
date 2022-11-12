pragma circom 2.0.0;

include "include/poseidon.circom";
include "include/bitify.circom";
include "include/sha256/sha256.circom";

include "tree.circom";

// Update a subtree of depth 4, where overall tree is of depth r + 4
template SubtreeUpdate4(r) {
    // public inputs
    signal input encodedPathAndHash;
    signal input accumulatorHash;
    signal output oldRoot;
    signal output newRoot;

    // merkle proof for the subtree's root
    signal input siblings[r];
    // Leaves to be inserted
    signal input leaves[2**4];

    component inner = SubtreeUpdate(r, 4);

    // root of the depth-4 subtree
    inner.emptySubtreeRoot <== 3607627140608796879659380071776844901612302623152076817094415224584923813162;
    inner.encodedPathAndHash <== encodedPathAndHash;
    inner.accumulatorHash <== accumulatorHash;
    inner.siblings <== siblings;
    inner.leaves <== leaves;
    oldRoot <== inner.oldRoot;
    newRoot <== inner.newRoot;
}

// Update a subtree of depth s, where overall tree is of depth r + s
template SubtreeUpdate(r, s) {

    // Public signals
    // r bits encodes the subTreelocation, 3 bits encode the high bits of accumulatorHash
    signal input encodedPathAndHash;

    signal input accumulatorHash;
    signal output oldRoot;
    signal output newRoot;

    // Merkle include witness for the subtree
    signal input siblings[r];
    // Leaves to be inserted
    signal input leaves[2**s];
    
    // a constant signal that should be passed in by the outer component
    // this should be set to to the value of the root of a depth-s subtree of zeros
    // this is a bit of a hack, but it's best way to do this while retaining parametricity for size
    // since circom doesn't have constant propogration yet
    signal input emptySubtreeRoot;

    // Opening up compressed path
    component path = Num2Bits(r+3);
    path.in <== encodedPathAndHash;

    // Merkle tree inclusion proof for old subtree
    component inclusionProof = MerkleTreeInclusionProof(r);
    inclusionProof.leaf <== emptySubtreeRoot;
    for (var i = 0; i < r; i++) {
        inclusionProof.siblings[i] <== siblings[i];
        inclusionProof.pathIndices[i] <== path.out[i];
    }
    oldRoot <== inclusionProof.root;

    // Compute accumulator hash for proposed leaves
    component hasher = Sha256(256 * 2**s);
    component leavesToBits[2**s];
    // set hash input
    for (var i = 0; i < 2**s; i++) {
        leavesToBits[i] = Num2Bits(254);
        leavesToBits[i].in <== leaves[i];
        for (var j = 0; j < 254; j++) {
          hasher.in[i*256 + j] <== leavesToBits[i].out[j];
        }
        hasher.in[i*256 + 254] <== 0;
        hasher.in[i*256 + 255] <== 0;
    }
    
    // Assert that the accumulatorHash is correct
    component hashBits = Num2Bits(253);
    hashBits.in <== accumulatorHash;
    for (var i = 0; i < 256; i++) {
        if (i < 3) {
            path.out[i] === hasher.out[i];
        }
        else {
            hashBits.out[i-3] === hasher.out[i];
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

    // Merkle tree inclusion proof for new subtree
    component inclusionProof2 = MerkleTreeInclusionProof(r);
    inclusionProof2.leaf <== nodes[0][0];
    for (var i = 0; i < r; i++) {
        inclusionProof2.siblings[i] <== siblings[i];
        inclusionProof2.pathIndices[i] <== path.out[i];
    }
    newRoot <== inclusionProof2.root;
}

component main { public [encodedPathAndHash, accumulatorHash] } = SubtreeUpdate4(28);
