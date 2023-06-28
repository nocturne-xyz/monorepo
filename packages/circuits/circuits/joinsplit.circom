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

    signal input refundAddrH1CompressedY;
    signal input refundAddrH2CompressedY;

    signal input refundAddrH1X;
    signal input refundAddrH1Y;
    signal input refundAddrH2X;
    signal input refundAddrH2Y;

    // spend signature
    signal input c;
    signal input z;

    // encodedAssetAddr, but with the sign bits of refundAddr placed at bits 248 and 249 (when zero-indexed in little-endian order)
    signal input encodedAssetAddrWithSignBits;
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
    signal input siblingsA[levels][3];

    // Old note B
    signal input oldNoteBOwnerH1X;
    signal input oldNoteBOwnerH1Y;
    signal input oldNoteBOwnerH2X;
    signal input oldNoteBOwnerH2Y;
    signal input oldNoteBNonce;
    signal input oldNoteBValue;

    // Path to old note B
    signal input pathB[levels];
    signal input siblingsB[levels][3];

    // New note A
    signal input newNoteAValue;

    // New note B
    signal input receiverCanonAddr[2];
    signal input newNoteBValue;

    // Public outputs
    signal output newNoteACommitment;
    signal output newNoteBCommitment;
    signal output anchor;
    signal output publicSpend;
    signal output nullifierA;
    signal output nullifierB;

    var BASE8[2] = [
        5299619240641551281634865583518297030282874472190772894086521144482721001553,
        16950150798460657717958625567821834550301663161624707787222815936182638968203
    ];
    var BABYJUB_SCALAR_FIELD_ORDER = 2736030358979909402780800718157159386076813972158567259200215660948447373041;

    // viewing keys must be elements of baby jubjub's scalar field
    signal viewKeyBits[251] <== Num2Bits(251)(userViewKey);
    component gtFrOrderMinusOne = CompConstant(BABYJUB_SCALAR_FIELD_ORDER - 1);
    for (var i=0; i<251; i++) {
      gtFrOrderMinusOne.in[i] <== viewKeyBits[i];
    }
    gtFrOrderMinusOne.in[251] <== 0;
    gtFrOrderMinusOne.in[252] <== 0;
    gtFrOrderMinusOne.in[253] <== 0;
    0 === gtFrOrderMinusOne.out;

    signal senderCanonAddr[2] <== CanonAddr()(viewKeyBits);

    // new note A's owner is sender's canonical address
    signal newNoteAOwnerH1X <== BASE8[0];
    signal newNoteAOwnerH1Y <== BASE8[1];
    signal newNoteAOwnerH2X <== senderCanonAddr[0];
    signal newNoteAOwnerH2Y <== senderCanonAddr[1];

    // new note B's owner is receiver's canonical address
    signal newNoteBOwnerH1X <== BASE8[0];
    signal newNoteBOwnerH1Y <== BASE8[1];
    signal newNoteBOwnerH2X <== receiverCanonAddr[0];
    signal newNoteBOwnerH2Y <== receiverCanonAddr[1];

    // check old note owners are composed of valid babyjubjub points
    // and are valid stealth addresses (H1 clears cofactor)
    BabyCheck()(oldNoteAOwnerH1X, oldNoteAOwnerH1Y);
    BabyCheck()(oldNoteAOwnerH2X, oldNoteAOwnerH2Y);
    IsOrderGreaterThan8()(oldNoteAOwnerH1X, oldNoteAOwnerH1Y);
    
    BabyCheck()(oldNoteBOwnerH1X, oldNoteBOwnerH1Y);
    BabyCheck()(oldNoteBOwnerH2X, oldNoteBOwnerH2Y);
    IsOrderGreaterThan8()(oldNoteBOwnerH1X, oldNoteBOwnerH1Y);

    // get encodedAssetAddr and sign bits out of encodedAssetAddrWithSignBits
    // don't need Num2Bits_strict here because it's only 253 bits
    signal encodedAssetAddrWithSignBitsBits[253] <==  Num2Bits(253)(encodedAssetAddrWithSignBits);
    signal refundAddrH1Sign <== encodedAssetAddrWithSignBitsBits[248];
    signal refundAddrH2Sign <== encodedAssetAddrWithSignBitsBits[249];

    // instead of doing another bit decomp, subtract 2^248 * refundAddrH1Sign + 2^249 * refundAddrH2Sign
    // from encodedAssetAddrWithSignBits
    signal refundAddrH1SignTimes2ToThe248 <== (1 << 248) * refundAddrH1Sign;
    signal encodedAssetAddrSubend <== (1 << 249) * refundAddrH2Sign + refundAddrH1SignTimes2ToThe248;
    signal encodedAssetAddr <== encodedAssetAddrWithSignBits - encodedAssetAddrSubend;

    // oldNoteACommitment
    signal oldNoteACommitment <== NoteCommit()(
      Poseidon(4)([oldNoteAOwnerH1X, oldNoteAOwnerH1Y, oldNoteAOwnerH2X, oldNoteAOwnerH2Y]),
      oldNoteANonce,
      encodedAssetAddr,
      encodedAssetId,
      oldNoteAValue
    );

    // oldNoteBCommitment
    signal oldNoteBCommitment <== NoteCommit()(
      Poseidon(4)([oldNoteBOwnerH1X, oldNoteBOwnerH1Y, oldNoteBOwnerH2X, oldNoteBOwnerH2Y]),
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
    VKIntegrity()(oldNoteAOwnerH1X, oldNoteAOwnerH1Y, oldNoteAOwnerH2X, oldNoteAOwnerH2Y, viewKeyBits);
    VKIntegrity()(oldNoteBOwnerH1X, oldNoteBOwnerH1Y, oldNoteBOwnerH2X, oldNoteBOwnerH2Y, viewKeyBits);

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
      Poseidon(4)([newNoteAOwnerH1X, newNoteAOwnerH1Y, newNoteAOwnerH2X, newNoteAOwnerH2Y]),
      newNoteANonce,
      encodedAssetAddr,
      encodedAssetId,
      newNoteAValue
    );

    // newNoteBCommitment
    newNoteBCommitment <== NoteCommit()(
      Poseidon(4)([newNoteBOwnerH1X, newNoteBOwnerH1Y, newNoteBOwnerH2X, newNoteBOwnerH2Y]),
      newNoteBNonce,
      encodedAssetAddr,
      encodedAssetId,
      newNoteBValue
    );

    // check refund addr is valid and derived from same VK to prevent transfers via refunds
    BabyCheck()(refundAddrH1X, refundAddrH1Y);
    BabyCheck()(refundAddrH2X, refundAddrH2Y);
    IsOrderGreaterThan8()(refundAddrH1X, refundAddrH1Y);
    VKIntegrity()(refundAddrH1X, refundAddrH1Y, refundAddrH2X, refundAddrH2Y, viewKeyBits);

    // compress the two points of the ciphertext.
    // connect the y cordinates to the output signals
    // and assert that the sign bits match what was given in `encodedAssetAddrWithSignBits`
    component compressors[2];
    compressors[0] = CompressPoint();
    compressors[0].in[0] <== refundAddrH1X;
    compressors[0].in[1] <== refundAddrH1Y;
    refundAddrH1CompressedY === compressors[0].y;
    refundAddrH1Sign === compressors[0].sign;

    compressors[1] = CompressPoint();
    compressors[1].in[0] <== refundAddrH2X;
    compressors[1].in[1] <== refundAddrH2Y;
    refundAddrH2CompressedY === compressors[1].y;
    refundAddrH2Sign === compressors[1].sign;


    // hash the refund addr as `H(refundAddrH1CompressedY, refundAddrH2CompressedY, refundAddrSigns, newNoteBNonce)`
    signal refundAddrSigns <== refundAddrH1Sign + (refundAddrH2Sign * 2);
    signal refundAddrHash <== Poseidon(4)([refundAddrH1CompressedY, refundAddrH2CompressedY, refundAddrSigns, newNoteBNonce]);
}

component main { public [encodedAssetAddrWithSignBits, encodedAssetId, operationDigest, refundAddrH1CompressedY, refundAddrH2CompressedY] } = JoinSplit(16);
