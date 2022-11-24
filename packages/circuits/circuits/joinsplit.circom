pragma circom 2.1.0;

include "include/babyjub.circom";
include "include/poseidon.circom";
include "include/escalarmulany.circom";
include "include/comparators.circom";

include "include/sha256/sha256.circom";

include "tree.circom";
include "lib.circom";

template JoinSplit(levels) {
    // Viewing / nullifying key
    signal input userViewKey;

    // Spend Pk
    signal input spendPubKey[2];
    signal input userViewKeyNonce;

    // Public inputs
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
    anchor <== MerkleTreeInclusionProof(levels)(oldNoteACommitment, pathA, siblingsA);

    // Merkle tree inclusion proof for oldNoteBCommitment
    signal anchorB <== MerkleTreeInclusionProof(levels)(oldNoteBCommitment, pathB, siblingsB);
    // Either oldNoteBValue is 0 (dummy note) or anchorB is equal to anchor
    oldNoteBValue * (anchor - anchorB) === 0;

    // Nullifier derivation for oldNoteA
    nullifierA <== Poseidon(2)([oldNoteACommitment, userViewKey]);

    // Nullifier derivation for oldNoteB
    nullifierB <== Poseidon(2)([oldNoteBCommitment, userViewKey]);

    // Asset, id, value, nonce
    encodedAsset <== oldNoteAEncodedAsset;
    oldNoteAEncodedAsset === oldNoteBEncodedAsset;
    oldNoteBEncodedAsset === newNoteAEncodedAsset;
    newNoteAEncodedAsset === newNoteBEncodedAsset;
    encodedId <== oldNoteAEncodedId;
    oldNoteAEncodedId === oldNoteBEncodedId;
    oldNoteBEncodedId === newNoteAEncodedId;
    newNoteAEncodedId === newNoteBEncodedId;

    signal valInput <== oldNoteAValue + oldNoteBValue;
    signal valOutput <== newNoteAValue + newNoteBValue;
    signal compOut <== LessEqThan(252)([valOutput, valInput]);
    compOut === 1;
    publicSpend <== valInput - valOutput;

    // Viewing key integrity for note A
    vkIntegrity()(oldNoteAOwnerH1X, oldNoteAOwnerH1Y, oldNoteAOwnerH2X, oldNoteAOwnerH2Y, userViewKey);

    // Viewing key integrity for note B
    vkIntegrity()(oldNoteBOwnerH1X, oldNoteBOwnerH1Y, oldNoteBOwnerH2X, oldNoteBOwnerH2Y, userViewKey);

    // Derive spending public key
    signal derivedViewKey <== Poseidon(3)([spendPubKey[0], spendPubKey[1], userViewKeyNonce]);
    userViewKey === derivedViewKey;

    // AuthSig validity
    SigVerify()(spendPubKey[0], spendPubKey[1], operationDigest, c, z);

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

component main { public [operationDigest] } = JoinSplit(32);
