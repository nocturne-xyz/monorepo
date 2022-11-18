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

template DeriveNullifier() {
    signal input vk;
    signal input noteCommitment;

    signal output nullifier;

    component hash = Poseidon(2);
    hash.inputs[0] <== vk;
    hash.inputs[1] <== noteCommitment;
    nullifier <== hash.out;
}
