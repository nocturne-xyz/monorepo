pragma circom 2.0.0;

include "include/poseidon.circom";

// Note structure
// owner, nonce, type, value

template NoteCommit() {
    signal input ownerH1Hash;
    signal input ownerH2Hash;
    signal input nonce;
    signal input type;
    signal input id;
    signal input value;

    signal output out;

    component addrHash = Poseidon(2);
    component noteHash = Poseidon(4);

    addrHash.inputs[0] <== ownerH1Hash;
    addrHash.inputs[1] <== ownerH2Hash;
    noteHash.inputs[0] <== addrHash.out;
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
