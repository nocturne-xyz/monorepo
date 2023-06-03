pragma circom 2.0.0;

include "include/poseidon.circom";
include "bitifyBE.circom";
include "include/sha256/sha256.circom";

include "lib.circom";
include "tree.circom";

// Update a quaternary subtree of depth 2, where overall tree is of depth r + 2
template SubtreeUpdate4(r) {
    var s = 2;
    // public inputs
    signal input encodedPathAndHash;
    signal input accumulatorHash;
    signal output oldRoot;
    signal output newRoot;

    // merkle proof for the subtree's root
    signal input siblings[r][3];
    // note commitments
    signal input leaves[4**s];
    // bitmap indicating which of the leaves don't appear in the accumulator hash
    // i.e. if the leaf was inserted by a joinsplit, then its corresponding bit will be 0, as we don't know the entire note
    // otherwise, it's 1, since the note was revealed on-chain
    signal input bitmap[4**s];

    // notes to be inserted
    signal input ownerH1Xs[4**s];
    signal input ownerH1Ys[4**s];
    signal input ownerH2Xs[4**s];
    signal input ownerH2Ys[4**s];
    signal input nonces[4**s];
    signal input encodedAssetAddrs[4**s];
    signal input encodedAssetIds[4**s];
    signal input values[4**s];

    component inner = SubtreeUpdate(r, s);

    // root of the depth-2 subtree
    inner.emptySubtreeRoot <== 6810774033780416412415162199345403563615586099663557224316660575326988281139;

    for (var i = 0; i < r; i++) {
        inner.siblings[i] <== siblings[i];
    }

    for (var i = 0; i < 4**s; i++) {
        inner.leaves[i] <== leaves[i];
        inner.bitmap[i] <== bitmap[i];
        inner.ownerH1Xs[i] <== ownerH1Xs[i];
        inner.ownerH1Ys[i] <== ownerH1Ys[i];
        inner.ownerH2Xs[i] <== ownerH2Xs[i];
        inner.ownerH2Ys[i] <== ownerH2Ys[i];
        inner.nonces[i] <== nonces[i];
        inner.encodedAssetAddrs[i] <== encodedAssetAddrs[i];
        inner.encodedAssetIds[i] <== encodedAssetIds[i];
        inner.values[i] <== values[i];
    }

    inner.encodedPathAndHash <== encodedPathAndHash;
    inner.accumulatorHash <== accumulatorHash;
    oldRoot <== inner.oldRoot;
    newRoot <== inner.newRoot;
}

// computes both poseidon and sha256 hash of a "concrete" note as defined in notion
template NoteCommitmentHash() {
    // ! NOTE: This assumes ristretto compression for addresses has been implemented
    signal input ownerH1X;
    signal input ownerH1Y;
    signal input ownerH2X;
    signal input ownerH2Y;
    signal input nonce;
    signal input encodedAssetAddr;
    signal input encodedAssetId;
    signal input value;

    // bits are in big-endian order
    signal output sha256HashBits[256];
    signal output noteCommitment;

    // compress owner address points
    component compressorH1 = CompressPoint();
    compressorH1.in[0] <== ownerH1X;
    compressorH1.in[1] <== ownerH1Y;
    signal h1Sign <== compressorH1.sign;
    signal h1CompressedY <== compressorH1.y;

    component compressorH2 = CompressPoint();
    compressorH2.in[0] <== ownerH2X;
    compressorH2.in[1] <== ownerH2Y;
    signal h2Sign <== compressorH2.sign;
    signal h2CompressedY <== compressorH2.y;

    // compute sha256 hash
    component sha256Hasher = Sha256(256 * 6);
    component elemBits[6];

    // pack bits into sha256 input
    elemBits[0] = Num2BitsBE_strict();
    elemBits[0].in <== h1CompressedY;

    elemBits[1] = Num2BitsBE_strict();
    elemBits[1].in <== h2CompressedY;

    elemBits[2] = Num2BitsBE_strict();
    elemBits[2].in <== nonce;

    elemBits[3] = Num2BitsBE_strict();
    elemBits[3].in <== encodedAssetAddr;

    elemBits[4] = Num2BitsBE_strict();
    elemBits[4].in <== encodedAssetId;

    elemBits[5] = Num2BitsBE_strict();
    elemBits[5].in <== value;

    // pack bits for H1 into hasher
    sha256Hasher.in[0] <== 0;
    sha256Hasher.in[1] <== h1Sign;
    for (var j = 0; j < 254; j++) {
        sha256Hasher.in[2 + j] <== elemBits[0].out[j];
    }

    // pack bits for H2 into hasher
    sha256Hasher.in[256] <== 0;
    sha256Hasher.in[256 + 1] <== h2Sign;
    for (var j = 0; j < 254; j++) {
        sha256Hasher.in[256 + 2 + j] <== elemBits[1].out[j];
    }

    // pack bits for rest of the fields into hasher
    for (var i = 2; i < 6; i++) {
        sha256Hasher.in[i*256] <== 0;
        sha256Hasher.in[i*256 + 1] <== 0;
        for (var j = 0; j < 254; j++) {
          sha256Hasher.in[i*256 + 2 + j] <== elemBits[i].out[j];
        }
    }

    for (var i = 0; i < 256; i++) {
        sha256HashBits[i] <== sha256Hasher.out[i];
    }

    noteCommitment <== NoteCommit()(
        Poseidon(4)([ownerH1X, ownerH1Y, ownerH2X, ownerH2Y]),
        nonce,
        encodedAssetAddr,
        encodedAssetId,
        value
    );
}

// Update a quaternary subtree of depth s, where overall tree is of depth r + s
template SubtreeUpdate(r, s) {

    // Public signals
    // 2*r bits encodes (each path index is 2 bits) the subTreelocation, 3 bits encode the high bits of accumulatorHash
    signal input encodedPathAndHash;

    signal input accumulatorHash;
    signal output oldRoot;
    signal output newRoot;

    // Merkle inclusion witness for the subtree
    signal input siblings[r][3];

    // note commitments
    signal input leaves[4**s];
    // bitmap indicating which of the leaves aren't "opaque" commitments
    // i.e. if the leaf was inserted by a joinsplit, then its corresponding bit will be 0, as we don't know the entire note
    // otherwise, it's 1, since the note was revealed on-chain
    signal input bitmap[4**s];

    // a constant signal that should be passed in by the outer component
    // this should be set to to the value of the root of a depth-s subtree of zeros
    // this is a bit of a hack, but it's best way to do this while retaining parametricity for size
    // since circom doesn't have constant propogration yet
    signal input emptySubtreeRoot;

    // notes to be inserted
    signal input ownerH1Xs[4**s];
    signal input ownerH1Ys[4**s];
    signal input ownerH2Xs[4**s];
    signal input ownerH2Ys[4**s];
    signal input nonces[4**s];
    signal input encodedAssetAddrs[4**s];
    signal input encodedAssetIds[4**s];
    signal input values[4**s];

    // binary-check the bitmap
    for (var i = 0; i < 4**s; i++) {
        bitmap[i] * (1 - bitmap[i]) === 0;
    }

    // hash the notes to get the tree leaves and sha256 hashes to check against accumulator
    signal accumulatorInnerHashes[4**s][256];
    signal tmp1[4**s][256];
    signal tmp2[4**s][256];
    component noteHashers[4**s];
    component leafBits[4**s];
    for (var i = 0; i < 4**s; i++) {
        noteHashers[i] = parallel NoteCommitmentHash();
        noteHashers[i].ownerH1X <== ownerH1Xs[i];
        noteHashers[i].ownerH1Y <== ownerH1Ys[i];
        noteHashers[i].ownerH2X <== ownerH2Xs[i];
        noteHashers[i].ownerH2Y <== ownerH2Ys[i];
        noteHashers[i].nonce <== nonces[i];
        noteHashers[i].encodedAssetAddr <== encodedAssetAddrs[i];
        noteHashers[i].encodedAssetId <== encodedAssetIds[i];
        noteHashers[i].value <== values[i];

        bitmap[i] * (noteHashers[i].noteCommitment - leaves[i]) === 0;

        leafBits[i] = Num2BitsBE_strict();
        leafBits[i].in <== leaves[i];
        for (var j = 0; j < 254; j++) {
            tmp2[i][j + 2] <== (1 - bitmap[i]) * leafBits[i].out[j];
        }
        tmp2[i][0] <== 0;
        tmp2[i][1] <== 0;

        for (var j = 0; j < 256; j++) {
            // For some reason circcom complains if I combine these into a single (still quadratic) constraint
            // if I don't split it up with a temp signal
            tmp1[i][j] <== bitmap[i] * noteHashers[i].sha256HashBits[j];
            accumulatorInnerHashes[i][j] <== tmp1[i][j] + tmp2[i][j];
        }
    }

    // decode pathIndices from encodedPathAndHash
    // note that we decode in LE order here - this is because `BitsToTwoBitLimbs` assumes LE.
    // this is equivalent to the BE way of describing it in the spec
    signal pathAndHashBits[2*r+3] <== Num2Bits(2*r+3)(encodedPathAndHash);
    signal pathBits[2*r] <== SliceFirstK(2*r+3, 2*r)(pathAndHashBits);
    signal accumulatorHashTop3Bits[3] <== SliceLastK(2*r+3, 3)(pathAndHashBits);
    signal pathIndices[r] <== BitsToTwoBitLimbs(r)(pathBits);
    oldRoot <== MerkleTreeInclusionProof(r)(emptySubtreeRoot, pathIndices, siblings);

    // Compute accumulator hash for proposed leaves
    component hasher = Sha256(256 * 4**s);

    // set accumulatorHash input
    // accumulatorHash input is a concatenation of all of the sha256 hashes for the notes as big-endian bitstrings
    for (var i = 0; i < 4**s; i++) {
        for (var j = 0; j < 256; j++) {
            hasher.in[i*256 + j] <== accumulatorInnerHashes[i][j];
        }
    }

    // Assert that the accumulatorHash is correct
    signal computedHashBits[253] <== Num2BitsBE(253)(accumulatorHash);
    for (var i = 0; i < 256; i++) {
        if (i < 3) {
            // pathBits are LE, hashBits are BE
            accumulatorHashTop3Bits[2-i] === hasher.out[i];
        } else {
            computedHashBits[i-3] === hasher.out[i];
        }
    }

    // Compute subtree root
    signal nodes[s+1][4**s];
    for (var i = 0; i < 4**s; i++) {
        nodes[s][i] <== leaves[i];
    }
    for (var i = s; i > 0; i--) {
      for (var j = 0; j < 4**(i-1); j++) {
        nodes[i-1][j] <== Poseidon(4)([
            nodes[i][4*j],
            nodes[i][4*j+1],
            nodes[i][4*j+2],
            nodes[i][4*j+3]
        ]);
      }
    }

    // Merkle tree inclusion proof for new subtree
    newRoot <== MerkleTreeInclusionProof(r)(nodes[0][0], pathIndices, siblings);
}

component main { public [encodedPathAndHash, accumulatorHash] } = SubtreeUpdate4(14);