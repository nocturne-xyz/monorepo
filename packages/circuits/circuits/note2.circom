pragma circom 2.0.0;

include "include/poseidon.circom";

// Note structure
// owner, nonce, encodedAsset, encodedId, value

template NoteCommit() {
    signal input ownerHash;
    signal input nonce;
    signal input encodedAsset;
    signal input encodedId;
    signal input value;

    signal output out;

    component noteHash = Poseidon(5);
    noteHash.inputs[0] <== ownerHash;
    noteHash.inputs[1] <== nonce;
    noteHash.inputs[2] <== encodedAsset;
    noteHash.inputs[3] <== encodedId;
    noteHash.inputs[4] <== value;

    out <== noteHash.out;
}

template Encrypt(n) {
    signal input rand;
    signal input in[n];

    signal output out[n];

    for (var i = 0; i < n; i++) {
      var pad = Poseidon(1)([rand + i]);
      out[i] <== pad + in[i];
    }
}

template DeriveNullifier() {
    signal input vk;
    signal input noteCommitment;

    signal output nullifier;

    component hash = Poseidon(2);
    hash.inputs[0] <== vk;
    hash.inputs[1] <== noteCommitment;
    nullifier <== hash.out;
}

template vkIntegrity() {
    signal input H1X;
    signal input H1Y;
    signal input H2X;
    signal input H2Y;
    signal input vk;

    // G = vk * H1
    signal GX, GY, GGX, GGY, GG2X, GG2Y, GG4X, GG4Y, GG8X, GG8Y;
    signal G[2];
    G <== EscalarMulAny(254)(Num2Bits(254)(vk), [H1X, H1Y]);
    // GG = vk * H1 - H2
    (GGX, GGY) <== BabyAdd()(G[0], G[1], -H2X, H2Y);
    (GG2X, GG2Y) <== BabyDbl()(GGX, GGY);
    (GG4X, GG4Y) <== BabyDbl()(GG2X, GG2Y);
    (GG8X, GG8Y) <== BabyDbl()(GG4X, GG4Y);

    GG8X === 0;
    GG8Y === 1;
}
