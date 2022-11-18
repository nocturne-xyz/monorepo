pragma circom 2.1.0;

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
    signal input oldNoteAEncodedAsset;
    signal input oldNoteAEncodedId;
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
    signal input oldNoteBEncodedAsset;
    signal input oldNoteBEncodedId;
    signal input oldNoteBValue;

    // Path to old note B
    signal input pathB[levels];
    signal input siblingsB[levels];

    // New note A
    signal input newNoteAOwnerH1X;
    signal input newNoteAOwnerH1Y;
    signal input newNoteAOwnerH2X;
    signal input newNoteAOwnerH2Y;
    signal input newNoteANonce;
    signal input newNoteAEncodedAsset;
    signal input newNoteAEncodedId;
    signal input newNoteAValue;

    // New note B
    signal input newNoteBOwnerH1X;
    signal input newNoteBOwnerH1Y;
    signal input newNoteBOwnerH2X;
    signal input newNoteBOwnerH2Y;
    signal input newNoteBNonce;
    signal input newNoteBEncodedAsset;
    signal input newNoteBEncodedId;
    signal input newNoteBValue;

    // Public outputs
    signal output newNoteACommitment;
    signal output newNoteBCommitment;
    signal output anchor;
    signal output encodedAsset;
    signal output encodedId;
    signal output publicSpend;
    signal output nullifierA;
    signal output nullifierB;

    // Computing oldNoteACommitment
    signal oldNoteACommitment <== NoteCommit()(
      Poseidon(2)([oldNoteAOwnerH1X, oldNoteAOwnerH2X]),
      oldNoteANonce,
      oldNoteAEncodedAsset,
      oldNoteAEncodedId,
      oldNoteAValue
    );

    // Computing oldNoteBCommitment
    signal oldNoteBCommitment <== NoteCommit()(
      Poseidon(2)([oldNoteBOwnerH1X, oldNoteBOwnerH2X]),
      oldNoteBNonce,
      oldNoteBEncodedAsset,
      oldNoteBEncodedId,
      oldNoteBValue
    );

    // Merkle tree inclusion proof for oldNoteACommitment
    anchor <== MerkleTreeInclusionProof(levels)(oldNoteACommitment, siblingsA, pathA);

    // Merkle tree inclusion proof for oldNoteBCommitment
    signal anchorB <== MerkleTreeInclusionProof(levels)(oldNoteBCommitment, siblingsB, pathB);
    anchor === anchorB;

    // Nullifier derivation for oldNoteA
    nullifierA <== DeriveNullifier()(oldNoteACommitment, vk);

    // Nullifier derivation for oldNoteB
    nullifierB <== DeriveNullifier()(oldNoteBCommitment, vk);

    // Asset, id, value, nonce
    encodedAsset <== oldNoteAEncodedAsset;
    oldNoteAEncodedAsset === oldNoteBEncodedAsset;
    oldNoteBEncodedAsset === newNoteAEncodedAsset;
    newNoteAEncodedAsset === newNoteBEncodedAsset;
    encodedId <== oldNoteAEncodedId;
    oldNoteAEncodedId === oldNoteBEncodedId;
    oldNoteBEncodedId === newNoteAEncodedId;
    newNoteAEncodedId === newNoteBEncodedId;
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
    signal derived_vk <== Poseidon(3)([spendPkX, spendPkY, spendPkNonce]);
    vk === derived_vk;

    // AuthSig validity
    Verify()(spendPkX, spendPkY, operationDigest, c, z);

    // Computing newNoteACommitment
    newNoteACommitment <== NoteCommit()(
      Poseidon(2)([newNoteAOwnerH1X, newNoteAOwnerH2X]),
      newNoteANonce,
      newNoteAEncodedAsset,
      newNoteAEncodedId,
      newNoteAValue
    );

    // Computing newNoteBCommitment
    newNoteBCommitment <== NoteCommit()(
      Poseidon(2)([newNoteBOwnerH1X, newNoteBOwnerH2X]),
      newNoteBNonce,
      newNoteBEncodedAsset,
      newNoteBEncodedId,
      newNoteBValue
    );
}

component main { public [operationDigest] } = Spend(32);
