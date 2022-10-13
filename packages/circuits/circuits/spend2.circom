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

    // Computing oldNoteCommitment
    signal oldNoteCommitment;
    component oldNoteCommit = NoteCommit();
    oldNoteCommit.ownerH1X <== oldNoteOwnerH1X; // TODO: change to compressed format
    oldNoteCommit.ownerH2X <== oldNoteOwnerH2X; // TODO: change to compressed format
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
    component H1vk = EscalarMulAny(254);
    H1vk.p[0] <== oldNoteOwnerH1X;
    H1vk.p[1] <== oldNoteOwnerH1Y;
    for (var i = 0; i < 254; i++) {
        H1vk.e[i] <== vkBits.out[i];
    }
    H1vk.out[0] === oldNoteOwnerH2X;
    H1vk.out[1] === oldNoteOwnerH2Y;

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

    // Computing newNoteCommitment
    component newNoteCommit = NoteCommit();
    newNoteCommit.ownerH1X <== newNoteOwnerH1X; // TODO: change to compressed format
    newNoteCommit.ownerH2X <== newNoteOwnerH2X; // TODO: change to compressed format
    newNoteCommit.nonce <== newNoteNonce;
    newNoteCommit.type <== newNoteType;
    newNoteCommit.id <== newNoteId;
    newNoteCommit.value <== newNoteValue;
    newNoteCommitment <== newNoteCommit.out;
}

component main { public [operationDigest] } = Spend(32);
