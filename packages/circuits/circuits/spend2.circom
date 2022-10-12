pragma circom 2.0.0;

include "include/babyjub.circom";
include "include/poseidon.circom";
include "include/escalarmulany.circom";

include "tree.circom";
include "note2.circom";
include "sig.circom";

template Spend(levels) {
    // viewing / nullifier key
    signal input vk;

    // Spend Pk
    signal input spendPkX;
    signal input spendPkY;
    signal input spendPkNonce;

    // Opeartion digest
    signal input operationDigest;

    // authSig
    signal input c;
    signal input z;

    // Old note
    signal input oldNoteOwnerH1X;
    signal input oldNoteOwnerH1Y;
    signal input oldNoteOwnerH2X;
    signal input oldNoteOwnerH2Y;
    signal input oldNoteNonce;
    signal input oldNoteType;
    signal input oldNoteId;
    signal input oldNoteValue;

    // Path to old note
    signal input path[levels];
    signal input siblings[levels];

    // New note
    signal input newNoteOwnerH1X;
    signal input newNoteOwnerH1Y;
    signal input newNoteOwnerH2X;
    signal input newNoteOwnerH2Y;
    signal input newNoteNonce;
    signal input newNoteType;
    signal input newNoteId;
    signal input newNoteValue;

    // Public outputs
    signal output newNoteCommitment;
    signal output anchor;
    signal output type;
    signal output id;
    signal output value;
    signal output nullifier;

    // Compute hash of oldNoteOwnerH1 x and y
    component oldNoteOwnerH1Hash = Poseidon(2);
    oldNoteOwnerH1Hash.inputs[0] <== oldNoteOwnerH1X;
    oldNoteOwnerH1Hash.inputs[1] <== oldNoteOwnerH1Y;

    // Compute hash of oldNoteOwnerH2 x and y
    component oldNoteOwnerH2Hash = Poseidon(2);
    oldNoteOwnerH2Hash.inputs[0] <== oldNoteOwnerH2X;
    oldNoteOwnerH2Hash.inputs[1] <== oldNoteOwnerH2Y;

    // Computing oldNoteCommitment
    signal oldNoteCommitment;
    component oldNoteCommit = NoteCommit();
    oldNoteCommit.ownerH1Hash <== oldNoteOwnerH1Hash.out;
    oldNoteCommit.ownerH2Hash <== oldNoteOwnerH2Hash.out;
    oldNoteCommit.nonce <== oldNoteNonce;
    oldNoteCommit.type <== oldNoteType;
    oldNoteCommit.id <== oldNoteId;
    oldNoteCommit.value <== oldNoteValue;
    oldNoteCommitment <== oldNoteCommit.out;

    // Merkle tree inclusion proof for oldNoteCommitment
    component inclusionProof = MerkleTreeInclusionProof(levels);
    inclusionProof.leaf <== oldNoteCommitment;
    for (var i = 0; i < levels; i++) {
        inclusionProof.siblings[i] <== siblings[i];
        inclusionProof.pathIndices[i] <== path[i];
    }

    anchor <== inclusionProof.root;

    // Nullifier derivation for oldNote
    component deriveNullifier = DeriveNullifier();
    deriveNullifier.noteCommitment <== oldNoteCommitment;
    deriveNullifier.vk <== vk;
    nullifier <== deriveNullifier.nullifier;

    // type and value
    type <== oldNoteType; oldNoteType === newNoteType;
    id <== oldNoteId; oldNoteId === newNoteId;
    value <== oldNoteValue - newNoteValue;

    // Viewing key integrity: h1^{vk} == h2
    component vkBits = Num2Bits(254);
    vkBits.in <== vk;

    // Derive spending public key
    component vkHasher = Poseidon(3);
    vkHasher.inputs[0] <== spendPkX;
    vkHasher.inputs[1] <== spendPkY;
    vkHasher.inputs[2] <== spendPkNonce;
    vkHasher.out === vk;

    // AuthSig validity
    component sigVerify = Verify();
    sigVerify.pkx <== spendPkX;
    sigVerify.pky <== spendPkY;
    sigVerify.m <== operationDigest;
    sigVerify.c <== c;
    sigVerify.z <== z;

    // Compute hash of newNoteOwnerH1 x and y
    component newNoteOwnerH1Hash = Poseidon(2);
    newNoteOwnerH1Hash.inputs[0] <== oldNoteOwnerH1X;
    newNoteOwnerH1Hash.inputs[1] <== oldNoteOwnerH1Y;

    // Compute hash of newNoteOwnerH2 x and y
    component newNoteOwnerH2Hash = Poseidon(2);
    newNoteOwnerH2Hash.inputs[0] <== oldNoteOwnerH2X;
    newNoteOwnerH2Hash.inputs[1] <== oldNoteOwnerH2Y;

    // Computing newNoteCommitment
    component newNoteCommit = NoteCommit();
    newNoteCommit.ownerH1Hash <== newNoteOwnerH1Hash.out;
    newNoteCommit.ownerH2Hash <== newNoteOwnerH2Hash.out;
    newNoteCommit.nonce <== newNoteNonce;
    newNoteCommit.type <== newNoteType;
    newNoteCommit.id <== newNoteId;
    newNoteCommit.value <== newNoteValue;
    newNoteCommitment <== newNoteCommit.out;
}

component main { public [operationDigest] } = Spend(32);
