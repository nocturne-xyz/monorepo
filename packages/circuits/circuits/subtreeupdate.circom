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

// computes both poseidon and sha256 hash of a "concrete" note as defined in notion
template NoteCommitmentHash() {
    // ! NOTE: This assumes ristretto compression for addresses has been implemented
    signal input owner;
    signal input nonce;
    signal input asset;
    signal input id;
    signal input value;

    // bits are in big-endian order
    signal output sha256HashBits[256];
    signal output poseidonHash;

    // compute sha256 hash
    component sha256Hasher = Sha256(256 * 5);
    component elemBits[8];
    for (var i = 0; i < 8; i++) {
        elemBits[i] = Num2Bits(254);
        for (var j = 0; j < 254; j++) {
          sha256hasher.in[i*256 + j] <== elemBits[i].out[j];
        }
        sha256Hasher.in[i*256 + 254] <== 0;
        sha256Hasher.in[i*256 + 255] <== 0;
    }
    
    sha256hashBits <== sha256Hasher.out;

    // compute poseidon hash 
    component hasher = Poseidon(5);
    hasher.inputs[0] <== owner;
    hasher.inputs[1] <== nonce;
    hasher.inputs[2] <== asset;
    hasher.inputs[3] <== id;
    hasher.inputs[4] <== value;

    poseidonHash <== hasher.out;
}

// Update a subtree of depth s, where overall tree is of depth r + s
template SubtreeUpdate(r, s) {

    // Public signals
    // r bits encodes the subTreelocation, 3 bits encode the high bits of accumulatorHash
    signal input encodedPathAndHash;

    signal input accumulatorHash;
    signal output oldRoot;
    signal output newRoot;

    // Merkle inclusion witness for the subtree
    signal input siblings[r];

    // a constant signal that should be passed in by the outer component
    // this should be set to to the value of the root of a depth-s subtree of zeros
    // this is a bit of a hack, but it's best way to do this while retaining parametricity for size
    // since circom doesn't have constant propogration yet
    signal input emptySubtreeRoot;

    // notes to be inserted
    // ! NOTE: This assumes ristretto compression for addresses has been implemented
    signal input owners[2**s];
    signal input nonces[2**s];
    signal input assets[2**s];
    signal input ids[2**s];
    signal input values[2**s];

    // hash the notes to get the tree leaves and sha256 hashes to check against accumulator
    signal leaves[2**s];
    signal noteCommitmentSha256Hashes[256][2**s];
    component noteHashers[2**s];
    for (var i = 0; i < 2**s; i++) {
        noteHashers[i] = parallel NoteCommitmentHash();
        noteHashers[i].owner <== owners[i];
        noteHashers[i].nonce <== nonces[i];
        noteHashers[i].asset <== assets[i];
        noteHashers[i].id <== id;
        noteHashers[i].value <== value;

        leaves[i] <== notehashers[i].poseidonHash;
        noteCommitmentSha256Hashes[i] <== noteHashers[i].sha256hashBits;
    }
    
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

    // set accumulatorHash input
    // accumulatorHash input is a concatenation of all of the sha256 hashes for the notes as big-endian bitstrings
    for (var i = 0; i < 2**s; i++) {
        for (var j = 0; j < 256; j++) {
            hasher.in[i*256 + j] <== noteCommitmentSha256Hashes[i][j];
        }
    }
    
    // Assert that the accumulatorHash is correct
    component hashBits = Num2Bits(253);
    hashBits.in <== accumulatorHash;
    for (var i = 0; i < 256; i++) {
        if (i < 3) {
            path.out[i] === hasher.out[i];
        } else {
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
