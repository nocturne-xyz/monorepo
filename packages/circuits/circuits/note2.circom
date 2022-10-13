pragma circom 2.0.0;

include "include/poseidon.circom";

// Note structure
// owner, nonce, type, value

template NoteCommit() {
    signal input ownerHash;
    signal input nonce;
    signal input type;
    signal input id;
    signal input value;

    signal output out;

    component noteHash = Poseidon(4);
    noteHash.inputs[0] <== ownerHash;
    noteHash.inputs[1] <== type;
    noteHash.inputs[2] <== id;
    noteHash.inputs[3] <== value;

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
