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
    // Operation digest
    signal input operationDigest;

    // spend signature
    signal input c;
    signal input z;

    // Shared note values
    signal input encodedAssetAddr;
    signal input encodedAssetId;

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
    signal input newNoteAValue;

    // New note B
    signal input receiverCanonAddr[2];
    signal input newNoteBValue;

    // randomness encrypting sender address
    // must be an element of Fr (251 bits)
    signal input encRandomness;

    // Public outputs
    signal output newNoteACommitment;
    signal output newNoteBCommitment;
    signal output anchor;
    signal output publicSpend;
    signal output nullifierA;
    signal output nullifierB;
    signal output encSenderCanonAddrC1X;
    signal output encSenderCanonAddrC2X;

    var BASE8[2] = [
        5299619240641551281634865583518297030282874472190772894086521144482721001553,
        16950150798460657717958625567821834550301663161624707787222815936182638968203
    ];

    signal senderCanonAddr[2] <== canonAddr()(userViewKey);

    // new note A's owner is sender's canonical address
    signal newNoteAOwnerH1X <== BASE8[0];
    signal newNoteuAOwnerH1Y <== BASE8[1];
    signal newNoteAOwnerH2X <== senderCanonAddr[0];
    signal newNoteAOwnerH2Y <== senderCanonAddr[1];

    // new note B's owner is receiver's canonical address
    signal newNoteBOwnerH1X <== BASE8[0];
    signal newNoteBOwnerH1Y <== BASE8[1];
    signal newNoteBOwnerH2X <== receiverCanonAddr[0];
    signal newNoteBOwnerH2Y <== receiverCanonAddr[1];

    // check old note owners are composed of valid babyjubjub points
    BabyCheck()(oldNoteAOwnerH1X, oldNoteAOwnerH1Y);
    BabyCheck()(oldNoteAOwnerH2X, oldNoteAOwnerH2Y);
    BabyCheck()(oldNoteBOwnerH1X, oldNoteBOwnerH1Y);
    BabyCheck()(oldNoteBOwnerH2X, oldNoteBOwnerH2Y);

    // oldNoteACommitment
    signal oldNoteACommitment <== NoteCommit()(
      Poseidon(2)([oldNoteAOwnerH1X, oldNoteAOwnerH2X]),
      oldNoteANonce,
      encodedAssetAddr,
      encodedAssetId,
      oldNoteAValue
    );

    // oldNoteBCommitment
    signal oldNoteBCommitment <== NoteCommit()(
      Poseidon(2)([oldNoteBOwnerH1X, oldNoteBOwnerH2X]),
      oldNoteBNonce,
      encodedAssetAddr,
      encodedAssetId,
      oldNoteBValue
    );

    // merkle tree inclusion proof for oldNoteACommitment
    anchor <== MerkleTreeInclusionProof(levels)(oldNoteACommitment, pathA, siblingsA);

    // merkle tree inclusion proof for oldNoteBCommitment
    signal anchorB <== MerkleTreeInclusionProof(levels)(oldNoteBCommitment, pathB, siblingsB);
    // check that either oldNoteBCommitment is a 'dummy' note or it's in the tree
    // check that one of the following is true:
    //  1. oldNoteBValue is 0 (dummy note)
    //  2. anchorB is equal to anchor
    oldNoteBValue * (anchor - anchorB) === 0;

    // derive nullifier for oldNoteA
    nullifierA <== Poseidon(2)([oldNoteACommitment, userViewKey]);

    // derive nullifier for oldNoteB
    nullifierB <== Poseidon(2)([oldNoteBCommitment, userViewKey]);

    // check that new note values are in range [0, 2**252)
    BitRange(252)(newNoteAValue);
    BitRange(252)(newNoteBValue);

    // check that old note values are in range [0, 2**252]
    BitRange(252)(oldNoteAValue);
    BitRange(252)(oldNoteBValue);

    // check that the sum of old and new note values are in range [0, 2**252)
    // this can't overflow because all four note values are in range [0, 2**252) and field is 254 bits
    signal valInput <== oldNoteAValue + oldNoteBValue;
    signal valOutput <== newNoteAValue + newNoteBValue;
    BitRange(252)(valInput);
    BitRange(252)(valOutput);

    // check that old note values hold at least as much value as new note values
    signal compOut <== LessEqThan(252)([valOutput, valInput]);
    compOut === 1;
    publicSpend <== valInput - valOutput;

    // check that old note owner addresses correspond to user's viewing key 
    vkIntegrity()(oldNoteAOwnerH1X, oldNoteAOwnerH1Y, oldNoteAOwnerH2X, oldNoteAOwnerH2Y, userViewKey);
    vkIntegrity()(oldNoteBOwnerH1X, oldNoteBOwnerH1Y, oldNoteBOwnerH2X, oldNoteBOwnerH2Y, userViewKey);

    // derive spending public key
    signal derivedViewKey <== Poseidon(3)([spendPubKey[0], spendPubKey[1], userViewKeyNonce]);
    userViewKey === derivedViewKey;

    // check spend signature
    SigVerify()(spendPubKey, operationDigest, [c, z]);

    // deterministically derive nonce for outgoing notes
    signal newNoteANonce <== Poseidon(2)([userViewKey, nullifierA]);
    signal newNoteBNonce <== Poseidon(2)([userViewKey, nullifierB]);

    // newNoteACommitment
    newNoteACommitment <== NoteCommit()(
      Poseidon(2)([newNoteAOwnerH1X, newNoteAOwnerH2X]),
      newNoteANonce,
      encodedAssetAddr,
      encodedAssetId,
      newNoteAValue
    );

    // newNoteBCommitment
    newNoteBCommitment <== NoteCommit()(
      Poseidon(2)([newNoteBOwnerH1X, newNoteBOwnerH2X]),
      newNoteBNonce,
      encodedAssetAddr,
      encodedAssetId,
      newNoteBValue
    );

    // encrypt sender's canonical address to receiver with ElGamal
    // receiver's public key is receiverCanonAddr

    // s := receiverCanonAddr x randomness
    signal sharedSecret[2] <== EscalarMulAny(251)(
      Num2Bits(251)(encRandomness),
      receiverCanonAddr
    );
    // c1 := basepoint x randomness
    signal c1[2] <== EscalarMulFix(251, BASE8)(
      Num2Bits(251)(encRandomness)
    );
    encSenderCanonAddrC1X <== c1[0];

    // c2 := senderCanonAddr + s
    component adder = BabyAdd();
    adder.x1 <== senderCanonAddr[0];
    adder.y1 <== senderCanonAddr[1];
    adder.x2 <== sharedSecret[0];
    adder.y2 <== sharedSecret[1];
    encSenderCanonAddrC2X <== adder.xout;
}

component main { public [encodedAssetAddr, encodedAssetId, operationDigest] } = JoinSplit(32);
