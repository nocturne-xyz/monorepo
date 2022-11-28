pragma circom 2.0.0;

include "include/babyjub.circom";
include "include/poseidon.circom";
include "include/escalarmulany.circom";

include "tree.circom";
include "lib.circom";

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
    signal input oldNoteAsset;
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
    signal input newNoteAsset;
    signal input newNoteId;
    signal input newNoteValue;

    // Public outputs
    signal output newNoteCommitment;
    signal output anchor;
    signal output asset;
    signal output id;
    signal output valueToSpend;
    signal output nullifier;

    // Compute hash of oldNoteOwner as H(h1X, h2X)
    component oldNoteOwnerHash = Poseidon(2);
    oldNoteOwnerHash.inputs[0] <== oldNoteOwnerH1X;
    oldNoteOwnerHash.inputs[1] <== oldNoteOwnerH2X;

    // Computing oldNoteCommitment
    signal oldNoteCommitment;
    component oldNoteCommit = NoteCommit();
    oldNoteCommit.ownerHash <== oldNoteOwnerHash.out;
    oldNoteCommit.nonce <== oldNoteNonce;
    oldNoteCommit.encodedAsset <== oldNoteAsset;
    oldNoteCommit.encodedId <== oldNoteId;
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

    // Asset, id, value, nonce
    asset <== oldNoteAsset;
    oldNoteAsset === newNoteAsset;
    id <== oldNoteId;
    oldNoteId === newNoteId;
    valueToSpend <== oldNoteValue - newNoteValue;

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
    component sigVerify = SigVerify();
    sigVerify.pkx <== spendPkX;
    sigVerify.pky <== spendPkY;
    sigVerify.m <== operationDigest;
    sigVerify.c <== c;
    sigVerify.z <== z;

    // Compute hash of newNoteOwner as H(h1X, h2X)
    component newNoteOwnerHash = Poseidon(2);
    newNoteOwnerHash.inputs[0] <== newNoteOwnerH1X;
    newNoteOwnerHash.inputs[1] <== newNoteOwnerH2X;


    // Computing newNoteCommitment
    component newNoteCommit = NoteCommit();
    newNoteCommit.ownerHash <== newNoteOwnerHash.out;
    newNoteCommit.nonce <== newNoteNonce;
    newNoteCommit.encodedAsset <== newNoteAsset;
    newNoteCommit.encodedId <== newNoteId;
    newNoteCommit.value <== newNoteValue;
    newNoteCommitment <== newNoteCommit.out;
}

component main { public [operationDigest] } = Spend(32);
