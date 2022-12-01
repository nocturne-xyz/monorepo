pragma circom 2.1.0;

include "include/babyjub.circom";
include "include/poseidon.circom";
include "include/comparators.circom";

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

    // Shared note values
    signal input encodedAsset;
    signal input encodedId;

    // Old note A
    signal input oldNoteAOwnerH1X;
    signal input oldNoteAOwnerH1Y;
    signal input oldNoteAOwnerH2X;
    signal input oldNoteAOwnerH2Y;
    signal input oldNoteANonce;
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
    signal input oldNoteBValue;

    // Path to old note B
    signal input pathB[levels];
    signal input siblingsB[levels];

    // New note A
    signal input newNoteANonce;
    signal input newNoteAValue;

    // New note B
    signal input receiverAddr[2];
    signal input newNoteBValue;

    // Public outputs
    signal output newNoteACommitment;
    signal output newNoteBCommitment;
    signal output anchor;
    signal output publicSpend;
    signal output nullifierA;
    signal output nullifierB;

    signal input issuerViewKeyX;
    signal input issuerViewKeyY;
    signal input encRandA;
    signal input encRandB;
    signal input anonReceiverRand;

    signal output encSenderInfo[3];
    signal output encReceiverInfo[3];
    signal output anonReceiverAddr[2];
    signal output encappedReceiverKey;
    signal output encappedIssuerKeyA;
    signal output encappedIssuerKeyB;

    var BASE8[2] = [
        5299619240641551281634865583518297030282874472190772894086521144482721001553,
        16950150798460657717958625567821834550301663161624707787222815936182638968203
    ];

    signal senderAddr[2] <== canonAddr()(userViewKey);
    signal newNoteAOwnerH1X <== BASE8[0];
    signal newNoteuAOwnerH1Y <== BASE8[1];
    signal newNoteAOwnerH2X <== senderAddr[0];
    signal newNoteAOwnerH2Y <== senderAddr[1];

    signal newNoteBOwnerH1X <== BASE8[0];
    signal newNoteBOwnerH1Y <== BASE8[1];
    signal newNoteBOwnerH2X <== receiverAddr[0];
    signal newNoteBOwnerH2Y <== receiverAddr[1];

    BabyCheck()(oldNoteAOwnerH1X, oldNoteAOwnerH1Y);
    BabyCheck()(oldNoteAOwnerH2X, oldNoteAOwnerH2Y);
    BabyCheck()(oldNoteBOwnerH1X, oldNoteBOwnerH1Y);
    BabyCheck()(oldNoteBOwnerH2X, oldNoteBOwnerH2Y);

    // Computing oldNoteACommitment
    signal oldNoteACommitment <== NoteCommit()(
      Poseidon(2)([oldNoteAOwnerH1X, oldNoteAOwnerH2X]),
      oldNoteANonce,
      encodedAsset,
      encodedId,
      oldNoteAValue
    );

    // Computing oldNoteBCommitment
    signal oldNoteBCommitment <== NoteCommit()(
      Poseidon(2)([oldNoteBOwnerH1X, oldNoteBOwnerH2X]),
      oldNoteBNonce,
      encodedAsset,
      encodedId,
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

    signal valInput <== oldNoteAValue + oldNoteBValue;
    signal valOutput <== newNoteAValue + newNoteBValue;
    BitRange(252)(newNoteAValue); // newNoteAValue < 2**252
    BitRange(252)(newNoteBValue); // newNoteBValue < 2**252
    BitRange(252)(valInput); // valInput < 2**252
    BitRange(252)(valOutput); // valOutput < 2**252
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
    SigVerify()(spendPubKey, operationDigest, [c, z]);

    // Computing newNoteACommitment
    newNoteACommitment <== NoteCommit()(
      Poseidon(2)([newNoteAOwnerH1X, newNoteAOwnerH2X]),
      newNoteANonce,
      encodedAsset,
      encodedId,
      newNoteAValue
    );

    // Deterministically derive nullifier for outgoing note
    signal newNoteBNonce <== Poseidon(2)([userViewKey, nullifierA]);

    // Computing newNoteBCommitment
    newNoteBCommitment <== NoteCommit()(
      Poseidon(2)([newNoteBOwnerH1X, newNoteBOwnerH2X]),
      newNoteBNonce,
      encodedAsset,
      encodedId,
      newNoteBValue
    );

    signal RA[2] <== EscalarMulFix(254, BASE8)(Num2Bits(254)(encRandA));
    signal RB[2] <== EscalarMulFix(254, BASE8)(Num2Bits(254)(encRandB));

    signal issuerViewKey[2] <== [issuerViewKeyX, issuerViewKeyY];

    signal encappedReceiverKeyPoint[2] <== EscalarMulAny(254)(Num2Bits(254)(encRandB), receiverAddr);
    signal encappedIssuerKeyAPoint[2] <== EscalarMulAny(254)(Num2Bits(254)(encRandA), issuerViewKey);
    signal encappedIssuerKeyBPoint[2] <== EscalarMulAny(254)(Num2Bits(254)(encRandB), issuerViewKey);

    encappedReceiverKey <== encappedReceiverKeyPoint[0];
    encappedIssuerKeyA <== encappedIssuerKeyAPoint[0];
    encappedIssuerKeyB <== encappedIssuerKeyBPoint[0];

    encReceiverInfo <== Encrypt(3)(RA[0], [senderAddr[0], newNoteBNonce, newNoteBValue]);
    encSenderInfo <== Encrypt(3)(RB[0], [receiverAddr[0], newNoteANonce, newNoteAValue]);
}

component main { public [encodedAsset, encodedId, operationDigest, issuerViewKeyX] } = JoinSplit(32);
