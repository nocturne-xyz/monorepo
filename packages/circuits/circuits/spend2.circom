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
    signal input oldNoteOwnerH3X;
    signal input oldNoteOwnerH3Y;
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
    signal input newNoteOwnerH3X;
    signal input newNoteOwnerH3Y;
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

    // Computing oldNoteCommitment
    signal oldNoteCommitment;
    component oldNoteCommit = NoteCommit();
    oldNoteCommit.ownerH1X <== oldNoteOwnerH1X; // TODO: change to compressed format
    oldNoteCommit.ownerH2X <== oldNoteOwnerH2X; // TODO: change to compressed format
    oldNoteCommit.ownerH3X <== oldNoteOwnerH3X; // TODO: change to compressed format
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

    component SpendingKeyCheck = EscalarMulAny(254);
    for (var i=0; i < 254; i++) {
        SpendingKeyCheck.e[i] <== vkBits.out[i];
    }
    SpendingKeyCheck.p[0] <== oldNoteOwnerH1X;
    SpendingKeyCheck.p[1] <== oldNoteOwnerH1Y;
    // SpendingKeyCheck.out[0] === oldNoteOwnerH2X;
    // SpendingKeyCheck.out[1] === oldNoteOwnerH2Y;
    signal temp0;
    signal temp1;
    temp0 <== SpendingKeyCheck.out[0];
    temp0 === oldNoteOwnerH2X;
    temp1 <== SpendingKeyCheck.out[1];
    temp1 === oldNoteOwnerH2Y;

    // AuthSig validity
    component sigVerify = Verify();
    sigVerify.pk0x <== oldNoteOwnerH1X;
    sigVerify.pk0y <== oldNoteOwnerH1Y;
    sigVerify.pk1x <== oldNoteOwnerH3X;
    sigVerify.pk1y <== oldNoteOwnerH3Y;
    sigVerify.m <== operationDigest;
    sigVerify.c <== c;
    sigVerify.z <== z;

    // Computing newNoteCommitment
    component newNoteCommit = NoteCommit();
    newNoteCommit.ownerH1X <== newNoteOwnerH1X; // TODO: change to compressed format
    newNoteCommit.ownerH2X <== newNoteOwnerH2X; // TODO: change to compressed format
    newNoteCommit.ownerH3X <== newNoteOwnerH3X; // TODO: change to compressed format
    newNoteCommit.nonce <== newNoteNonce;
    newNoteCommit.type <== newNoteType;
    newNoteCommit.id <== newNoteId;
    newNoteCommit.value <== newNoteValue;
    newNoteCommitment <== newNoteCommit.out;
}

component main { public [operationDigest, c, z] } = Spend(32);
