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

    // Old note A
    signal input oldNoteAOwnerH1X;
    signal input oldNoteAOwnerH1Y;
    signal input oldNoteAOwnerH2X;
    signal input oldNoteAOwnerH2Y;
    signal input oldNoteANonce;
    signal input oldNoteAAsset;
    signal input oldNoteAId;
    signal input oldNoteAValue;

    // Path to old note A
    signal input pathA[levels];
    signal input siblingsA[levels];

    // Old note B
    signal input oldNoteBOwnerH1X;
    signal input oldNoteBOwnerH1Y;
    signal input oldNoteBOwnerH2X;
    signal input oldNoteBOwnerH2Y;
    signal input oldNoteBNonce;
    signal input oldNoteBAsset;
    signal input oldNoteBId;
    signal input oldNoteBValue;

    // Path to old note A
    signal input pathB[levels];
    signal input siblingsB[levels];

    // New note A
    signal input newNoteAOwnerH1X;
    signal input newNoteAOwnerH1Y;
    signal input newNoteAOwnerH2X;
    signal input newNoteAOwnerH2Y;
    signal input newNoteANonce;
    signal input newNoteAAsset;
    signal input newNoteAId;
    signal input newNoteAValue;

    // New note B
    signal input newNoteBOwnerH1X;
    signal input newNoteBOwnerH1Y;
    signal input newNoteBOwnerH2X;
    signal input newNoteBOwnerH2Y;
    signal input newNoteBNonce;
    signal input newNoteBAsset;
    signal input newNoteBId;
    signal input newNoteBValue;

    // Public outputs
    signal output newNoteACommitment;
    signal output newNoteBCommitment;
    signal output anchor;
    signal output asset;
    signal output id;
    signal output publicSpend;
    signal output nullifierA;
    signal output nullifierB;

    // Compute hash of oldNoteAOwner as H(h1X, h1Y, h2X, h2Y)
    component oldNoteAOwnerHash = Poseidon(4);
    oldNoteAOwnerHash.inputs[0] <== oldNoteAOwnerH1X;
    oldNoteAOwnerHash.inputs[1] <== oldNoteAOwnerH1Y;
    oldNoteAOwnerHash.inputs[2] <== oldNoteAOwnerH2X;
    oldNoteAOwnerHash.inputs[3] <== oldNoteAOwnerH2Y;

    // Compute hash of oldNoteBOwner as H(h1X, h1Y, h2X, h2Y)
    component oldNoteBOwnerHash = Poseidon(4);
    oldNoteBOwnerHash.inputs[0] <== oldNoteBOwnerH1X;
    oldNoteBOwnerHash.inputs[1] <== oldNoteBOwnerH1Y;
    oldNoteBOwnerHash.inputs[2] <== oldNoteBOwnerH2X;
    oldNoteBOwnerHash.inputs[3] <== oldNoteBOwnerH2Y;

    // Computing oldNoteACommitment
    signal oldNoteACommitment;
    component oldNoteACommit = NoteCommit();
    oldNoteACommit.ownerHash <== oldNoteAOwnerHash.out;
    oldNoteACommit.nonce <== oldNoteANonce;
    oldNoteACommit.asset <== oldNoteAAsset;
    oldNoteACommit.id <== oldNoteAId;
    oldNoteACommit.value <== oldNoteAValue;
    oldNoteACommitment <== oldNoteACommit.out;

    // Computing oldNoteBCommitment
    signal oldNoteBCommitment;
    component oldNoteBCommit = NoteCommit();
    oldNoteBCommit.ownerHash <== oldNoteBOwnerHash.out;
    oldNoteBCommit.nonce <== oldNoteBNonce;
    oldNoteBCommit.asset <== oldNoteBAsset;
    oldNoteBCommit.id <== oldNoteBId;
    oldNoteBCommit.value <== oldNoteBValue;
    oldNoteBCommitment <== oldNoteBCommit.out;

    // Merkle tree inclusion proof for oldNoteACommitment
    component inclusionProofA = MerkleTreeInclusionProof(levels);
    inclusionProofA.leaf <== oldNoteACommitment;
    for (var i = 0; i < levels; i++) {
        inclusionProofA.siblings[i] <== siblingsA[i];
        inclusionProofA.pathIndices[i] <== pathA[i];
    }

    anchor <== inclusionProofA.root;

    component inclusionProofB = MerkleTreeInclusionProof(levels);
    inclusionProofB.leaf <== oldNoteBCommitment;
    for (var i = 0; i < levels; i++) {
        inclusionProofB.siblings[i] <== siblingsB[i];
        inclusionProofB.pathIndices[i] <== pathB[i];
    }

    anchor === inclusionProofB.root;

    // Nullifier derivation for oldNoteA
    component deriveNullifierA = DeriveNullifier();
    deriveNullifierA.noteCommitment <== oldNoteACommitment;
    deriveNullifierA.vk <== vk;
    nullifierA <== deriveNullifierA.nullifier;

    // Nullifier derivation for oldNoteB
    component deriveNullifierB = DeriveNullifier();
    deriveNullifierB.noteCommitment <== oldNoteBCommitment;
    deriveNullifierB.vk <== vk;
    nullifierB <== deriveNullifierB.nullifier;

    // Asset, id, value, nonce
    asset <== oldNoteAAsset;
    oldNoteAAsset === oldNoteBAsset;
    oldNoteBAsset === newNoteAAsset;
    newNoteAAsset === newNoteBAsset;
    id <== oldNoteAId;
    oldNoteAId === oldNoteBId;
    oldNoteBId === newNoteAId;
    newNoteAId === newNoteBId;
    publicSpend <== oldNoteAValue + oldNoteBValue - newNoteAValue - newNoteBValue;

    // Viewing key integrity for note A: h1^{vk} == h2
    component vkBits = Num2Bits(254);
    vkBits.in <== vk;
    component H1vkA = EscalarMulAny(254);
    H1vkA.p[0] <== oldNoteAOwnerH1X;
    H1vkA.p[1] <== oldNoteAOwnerH1Y;
    for (var i = 0; i < 254; i++) {
        H1vkA.e[i] <== vkBits.out[i];
    }
    H1vkA.out[0] === oldNoteAOwnerH2X;
    H1vkA.out[1] === oldNoteAOwnerH2Y;

    // Viewing key integrity for note B: h1^{vk} == h2
    component H1vkB = EscalarMulAny(254);
    H1vkB.p[0] <== oldNoteBOwnerH1X;
    H1vkB.p[1] <== oldNoteBOwnerH1Y;
    for (var i = 0; i < 254; i++) {
        H1vkB.e[i] <== vkBits.out[i];
    }
    H1vkB.out[0] === oldNoteBOwnerH2X;
    H1vkB.out[1] === oldNoteBOwnerH2Y;

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

    // Compute hash of newNoteAOwner as H(h1X, h1Y, h2X, h2Y)
    component newNoteAOwnerHash = Poseidon(4);
    newNoteAOwnerHash.inputs[0] <== newNoteAOwnerH1X;
    newNoteAOwnerHash.inputs[1] <== newNoteAOwnerH1Y;
    newNoteAOwnerHash.inputs[2] <== newNoteAOwnerH2X;
    newNoteAOwnerHash.inputs[3] <== newNoteAOwnerH2Y;

    // Compute hash of newNoteBOwner as H(h1X, h1Y, h2X, h2Y)
    component newNoteBOwnerHash = Poseidon(4);
    newNoteBOwnerHash.inputs[0] <== newNoteBOwnerH1X;
    newNoteBOwnerHash.inputs[1] <== newNoteBOwnerH1Y;
    newNoteBOwnerHash.inputs[2] <== newNoteBOwnerH2X;
    newNoteBOwnerHash.inputs[3] <== newNoteBOwnerH2Y;

    // Computing newNoteACommitment
    component newNoteACommit = NoteCommit();
    newNoteACommit.ownerHash <== newNoteAOwnerHash.out;
    newNoteACommit.nonce <== newNoteANonce;
    newNoteACommit.asset <== newNoteAAsset;
    newNoteACommit.id <== newNoteAId;
    newNoteACommit.value <== newNoteAValue;
    newNoteACommitment <== newNoteACommit.out;

    // Computing newNoteBCommitment
    component newNoteBCommit = NoteCommit();
    newNoteBCommit.ownerHash <== newNoteBOwnerHash.out;
    newNoteBCommit.nonce <== newNoteBNonce;
    newNoteBCommit.asset <== newNoteBAsset;
    newNoteBCommit.id <== newNoteBId;
    newNoteBCommit.value <== newNoteBValue;
    newNoteBCommitment <== newNoteBCommit.out;
}

component main { public [operationDigest] } = Spend(32);
