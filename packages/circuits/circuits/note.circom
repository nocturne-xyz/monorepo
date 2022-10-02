pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";

// Note structure
// owner, nonce, type, value

template Anonymize() {
    signal input ownerH1X;
    signal input ownerH1Y;
    signal input ownerH2X;
    signal input ownerH2Y;
    signal input nonce;

    signal output anonAddr;

    component hash = Poseidon(5);

    hash.inputs[0] <== ownerH1X;
    hash.inputs[1] <== ownerH1Y;
    hash.inputs[2] <== ownerH2X;
    hash.inputs[3] <== ownerH2Y;
    hash.inputs[4] <== nonce;

    anonAddr <== hash.out;
}

template NoteCommit() {
    signal input ownerH1X;
    signal input ownerH1Y;
    signal input ownerH2X;
    signal input ownerH2Y;
    signal input nonce;
    signal input type;
    signal input value;

    signal output out;

    component anonymize = Anonymize();

    anonymize.ownerH1X <== ownerH1X;
    anonymize.ownerH1Y <== ownerH1Y;
    anonymize.ownerH2X <== ownerH1X;
    anonymize.ownerH2Y <== ownerH1Y;
    anonymize.nonce <== nonce;

    component hash = Poseidon(3);

    hash.inputs[0] <== anonymize.anonAddr;
    hash.inputs[1] <== type;
    hash.inputs[2] <== value;

    out <== hash.out;
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
