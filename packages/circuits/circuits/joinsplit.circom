pragma circom 2.1.0;

include "include/babyjub.circom";
include "include/poseidon.circom";
include "include/escalarmulany.circom";

include "include/sha256/sha256.circom";

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

    // Public inputs
    // Opeartion digest
    signal input operationDigest;
    // Asset viewing public key
    signal input assetViewingPubKey[2];
    // Asset freezing public key
    signal input assetFreezingPubKey[2];

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
    signal output encryptedNoteA[3];
    signal output encryptedNoteB[3];
    signal output encryptedPad;

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

    // Derive nullifying key
    signal nk, G[2];
    G <== EscalarMulAny(254)(Num2Bits(254)(vk), assetFreezingPubKey);
    nk <== Poseidon(2)(G);

    // Nullifier derivation for oldNoteA
    nullifierA <== DeriveNullifier()(oldNoteACommitment, nk);

    // Nullifier derivation for oldNoteB
    nullifierB <== DeriveNullifier()(oldNoteBCommitment, nk);

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

    // Viewing key integrity for note A: H1^{vk} == H2
    vkIntegrity()(oldNoteAOwnerH1X, oldNoteAOwnerH1Y, oldNoteAOwnerH2X, oldNoteAOwnerH2Y, vk);

    // Viewing key integrity for note B: H1^{vk} == H2
    vkIntegrity()(oldNoteBOwnerH1X, oldNoteBOwnerH1Y, oldNoteBOwnerH2X, oldNoteBOwnerH2Y, vk);

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

    // Compute
    signal input r;
    encryptedNoteA <== Encrypt(3)(r, [newNoteAOwnerH1X, newNoteANonce, newNoteAValue]);
    encryptedNoteB <== Encrypt(3)(r, [newNoteBOwnerH1X, newNoteBNonce, newNoteBValue]);

    signal input rr;
    signal RR[2] <== EscalarMulAny(254)(Num2Bits(254)(rr), assetViewingPubKey);
    signal pad <== Poseidon(2)(RR);
    encryptedPad <== pad + r;
}

component main { public [operationDigest] } = Spend(32);
