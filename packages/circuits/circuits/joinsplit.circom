pragma circom 2.1.0;

include "include/babyjub.circom";
include "include/poseidon.circom";
include "include/comparators.circom";

include "tree.circom";
include "lib.circom";

//@requires(1.1) `operationDigest is the cryptographic hash of a valid Nocturne operation that this JoinSplit is a part of
//@requires(1.2) all public inputs correspond to the same JoinSplit, and that JoinSplit is contained in the operation whose digest is `operationDigest`
//@requires(2) `pubEncodedAssetId` fits in 253 bits
//@requires(3.1) the encoding of `pubEncodedAssetAddrWithSignBits` from `(assetIDUpper3Bits, refundAddrH1SignX, refundAddrH2SignX, assetType, assetAddress)` is correct
//@requires(3.2) `pubEncodedAssetId` and `pubEncodedAssetAddrWithSignBits` were encoded solely from the respective values in the JoinSplit, which is contained in the operation whose digest is `operationDigest`, or 0 if `publicSpend` is 0 (except for the sign bits, which still correspond to the refund address)
//@requires(4) `refundAddrH1CompressedY` and `refundAddrH2CompressedY` are as specified in the op whose digest is `operationDigest`
//@requires(5) `commitmentTreeRoot` is the root of the commitment tree in the Nocturne Handler contract
//@requires(6.1) `nullifierA` is the nullifier of `oldNoteA` given in this JoinSplit, whose digest is `operationDigest`
//@requires(6.2) `nullifierB` is the nullifier of `oldNoteB` given in this JoinSplit, whose digest is `operationDigest`
//@requires(7) `senderCommitment` is the `senderCommitment` given in the operation whose digest is `operationDigest`
//
//@ensures(1.1) if `publicSpend` is nonzero, `pubEncodedAssetId` matches that found in the `encodedAssetId` field of both old notes and both new notes
//@ensures(1.2) if `publicSpend` is zero, `pubEncodedAssetId` is 0
//@ensures(2.1) if `publicSpend` is nonzero, and one were to mask the sign bits to zero, `pubEncodedAssetAddrWithSignBits` would match the `encodedAssetAddr` field in both old notes and both new notes
//@ensures(2.2) if `publicSpend` is zero, the asset contract address bits, asset type bits, and asset ID bits in `pubEncodedAssetAddrWithSignBits` are all 0
//@ensures(3.1) `newNoteACommitment` is the note commitment for the first new note, newNoteA
//@ensures(3.2) `newNoteBCommitment` is the note commitment for the second new note, newNoteB
//@ensures(4) the viewing key `vk` used to derive nullifiers and addresses was correctly derived from the spend pubkey `spendPubkey`
//@ensures(5) the operation signature `(c, z)` is a valid Schnorr signature of `operationDigest` under the spend pubkey `spendPubkey`
//@ensures(6.1) the owner field of `oldNoteA`, `oldNoteAOwner`, is a valid babyjubjub point
//@ensures(6.2) the owner field of `oldNoteB`, `oldNoteBOwner`, is a valid babyjubjub point
//@ensures(6.3) the owner field of `oldNoteA`, `oldNoteAOwner`, is of order greater than 8 (i.e. it clears the cofactor)
//@ensures(6.4) the owner field of `oldNoteB`, `oldNoteBOwner`, is of order greater than 8 (i.e. it clears the cofactor)
//@ensures(6.5) the owner field of `oldNoteA, `oldNoteAOwner`, is "owned" by the viewing key `vk` according to the Nocturne Stealth Address scheme
//@ensures(6.6) the owner field of `oldNoteB, `oldNoteBOwner`, is "owned" by the viewing key `vk` according to the Nocturne Stealth Address scheme
//@ensures(6.3) the owner fields of the old notes - `oldNoteAOwner` and `oldNoteBOwner` - are "owned" by the viewing key `vk` according to the Nocturne Stealth Address scheme
//@ensures(7.1) `refundAddrH1CompressedY`, along with its sign bit extracted from `pubEncodedAssetAddrWithSignBits`, represents a valid (on-curve), high-order babyjubjub point according to Nocturne's point compression scheme
//@ensures(7.2) `refundAddrH2CompressedY`, along with its sign bit extracted from `pubEncodedAssetAddrWithSignBits`, represents a valid (on-curve), high-order babyjubjub point according to Nocturne's point compression scheme
//@ensures(7.3) `refundAddrH1CompressedY` and `refundAddrH2` is "owned" by same viewing key as the old note owners, as defined by the "ownership check" of the Nocturne Stealth Address scheme.
//@ensures(7.4) `refundAddrH2CompressedY` is "owned" by same viewing key as the old note owners, as defined by the "ownership check" of the Nocturne Stealth Address scheme.
//@ensures(8.1) `newNoteACommitment` is included in the quaternary Poseidon merkle tree whose root is `commitmentTreeRoot`
//@ensures(8.2) `newNoteBCommitment` is included in the quaternary Poseidon merkle tree whose root is `commitmentTreeRoot`
//@ensures(9.1) `nullifierA` was correctly derived from the note commitment of `oldNoteA` and the viewing key `vk`
//@ensures(9.2) `nullifierB` was correctly derived from the note commitment of `oldNoteB` and the viewing key `vk`
//@ensures(10.1) `oldNoteAValue` is in the range [0, 2**252)
//@ensures(10.2) `oldNoteBValue` is in the range [0, 2**252)
//@ensures(10.3) `newNoteAValue` is in the range [0, 2**252)
//@ensures(10.4) `newNoteBValue` is in the range [0, 2**252)
//@ensures(10.5) `oldNoteAValue + oldNoteBValue` is in the range [0, 2**252)
//@ensures(10.6) `newNoteAValue + newNoteBValue` is in the range [0, 2**252)
//@ensures(11.1) `oldNoteAValue + oldNoteBValue >= newNoteAValue + newNoteBValue`
//@ensures(11.2) `publicSpend == oldNoteAValue + oldNoteBValue - newNoteAValue - newNoteBValue`
//@ensures(12.1) the sender's canonical address used in `senderCommitment` is the canonical address derived from `vk`
//@ensures(12.2) `senderCommitment` is computed correctly as `Poseidon(keccak256("SENDER_COMMITMENT") % p, senderCanonAddrX, senderCanonAddrY, newNoteBNonce"))`
template JoinSplit(levels) {

    // *** PUBLIC INPUTS ***
    // digest of the operation this JoinSplit is a part of
    // this is used to bind each JoinSplit to an operation and as the message for the signature
    signal input operationDigest;

    // the lower 253 bits of the ID of the asset being transferred. In the case of ERC20, this is 0.
    // if the `publicSpend` is 0, is set to 0
    signal input pubEncodedAssetId;


    // encodedAssetAddr, but with the sign bits of refundAddr placed at bits 248 and 249 (when zero-indexed in little-endian order)
    // if publicSpend is nonzero, we assert that `encodedAssetAddr` matches that specified in the `encodedAssetAddr` bits of this input
    // if publicSpend is 0, we assert that this the `encodedAssetAddr` part of this PI is 0.
    // the address of the asset being transferred, with the upper 3 bits of the asset ID, 2 bits for the asset type and the sign bits of `refundAddrH1CompressedY` and `refundAddrH2CompressedY` packed-in
    // the bit packing is defined as follows, from the most significant bit to the least significant bit:
    // - 3 0 bits
    // - 3 bits for the the upper 3 bits of the asset ID
    // - 1 sign bit for `refundAddrH1CompressedY`
    // - 1 sign bit for `refundAddrH2CompressedY`
    // - 86 bits that are left unspecified
    // - 2 bits for the asset type - 00 for ERC20, 01 for ERC721, 10 for ERC1155, 11 is unsupported (illegal)
    // - 160 bits for the asset's contract address
    signal input pubEncodedAssetAddrWithSignBits;

    // the Y coordinates of both components of the operation's refund address
    // the circuit will ensure that the refund address is "owned" by the spender, preventing transfers via refunds
    signal input refundAddrH1CompressedY;
    signal input refundAddrH2CompressedY;

    // the note commitments of the two notes being created as a result of this JoinSplit
    signal output newNoteACommitment;
    signal output newNoteBCommitment;

    // the root of the commitment tree root in the Nocturne Handler contract
    signal output commitmentTreeRoot;
    // the amount of the asset to be spent publicly by withdrawing it from the Teller contract. This is the difference between the sum of the old note values and the sum of the new note values.
    // as per the protocol, this must be in the range [0, 2**252)
    signal output publicSpend;

    // nullifiers for the two notes being spent via this JoinSplit
    signal output nullifierA;
    signal output nullifierB;

    // blinded commitment to the sender's canonical address so that the recipient can verify the sender.
    // defined as Poseidon(keccak256("SENDER_COMMITMENT") % p, senderCanonAddrX, senderCanonAddrY, newNoteBNonce"))
    signal output senderCommitment;


    // *** WITNESS ***

    // viewing key 
    signal input vk;

    // spend pubkey
    signal input spendPubkey[2];
    // nonce used to generate the viewing key from the spend pubkey
    signal input vkNonce;

    // operation signature
    signal input c;
    signal input z;

    // info indentifying the asset this JoinSplit is spending
    // encoded into field elements. See above for encoding
    signal input encodedAssetId;
    signal input encodedAssetAddr;

    // the uncompressed refund address specified by the operation
    signal input refundAddrH1X;
    signal input refundAddrH1Y;
    signal input refundAddrH2X;
    signal input refundAddrH2Y;

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

    // the "base point" of BabyJubjub 0. That is, the generator of the prime-order subgroup
    var BASE8[2] = [
        5299619240641551281634865583518297030282874472190772894086521144482721001553,
        16950150798460657717958625567821834550301663161624707787222815936182638968203
    ];
    var BABYJUB_SCALAR_FIELD_ORDER = 2736030358979909402780800718157159386076813972158567259200215660948447373041;

    // viewing keys must be elements of baby jubjub's scalar field
    signal viewKeyBits[251] <== Num2Bits(251)(vk);
    component gtFrOrderMinusOne = CompConstant(BABYJUB_SCALAR_FIELD_ORDER - 1);
    for (var i=0; i<251; i++) {
      gtFrOrderMinusOne.in[i] <== viewKeyBits[i];
    }
    gtFrOrderMinusOne.in[251] <== 0;
    gtFrOrderMinusOne.in[252] <== 0;
    gtFrOrderMinusOne.in[253] <== 0;
    0 === gtFrOrderMinusOne.out;

    // sender's canonical address, derived from the viewing key
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

    // check receiver canon addr is a valid babyjubjub point
    BabyCheck()(receiverCanonAddr[0], receiverCanonAddr[1]);
    IsOrderGreaterThan8()(receiverCanonAddr[0], receiverCanonAddr[1]);

    // check old note owners are composed of valid babyjubjub points
    BabyCheck()(oldNoteAOwnerH1X, oldNoteAOwnerH1Y);
    BabyCheck()(oldNoteAOwnerH2X, oldNoteAOwnerH2Y);
    IsOrderGreaterThan8()(oldNoteAOwnerH1X, oldNoteAOwnerH1Y);

    BabyCheck()(oldNoteBOwnerH1X, oldNoteBOwnerH1Y);
    BabyCheck()(oldNoteBOwnerH2X, oldNoteBOwnerH2Y);
    IsOrderGreaterThan8()(oldNoteBOwnerH1X, oldNoteBOwnerH1Y);

    // get encodedAssetAddr and sign bits of refund addr out of pubEncodedAssetAddrWithSignBits
    // don't need Num2Bits_strict here because it's only 253 bits
    signal pubEncodedAssetAddrWithSignBitsBits[253] <==  Num2Bits(253)(pubEncodedAssetAddrWithSignBits);
    signal refundAddrH1Sign <== pubEncodedAssetAddrWithSignBitsBits[248];
    signal refundAddrH2Sign <== pubEncodedAssetAddrWithSignBitsBits[249];

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

    // instead of doing another bit decomp, subtract 2^248 * refundAddrH1Sign + 2^249 * refundAddrH2Sign 
    // from pubEncodedAssetAddrWithSignBits
    signal refundAddrH1SignTimes2ToThe248 <== (1 << 248) * refundAddrH1Sign;
    signal encodedAssetAddrSubend <== (1 << 249) * refundAddrH2Sign + refundAddrH1SignTimes2ToThe248;
    signal encodedAssetAddrDecoded <== pubEncodedAssetAddrWithSignBits - encodedAssetAddrSubend;

    signal publicSpendIsZero <== IsZero()(publicSpend);
    // if publicSpend is nonzero, check that encodedAssetAddr matches encodedAssetAddrDecoded
    // otherwise, assert that encodedAssetAddrDecoded is also zero
    encodedAssetAddrDecoded === (1 - publicSpendIsZero) * encodedAssetAddr;

    // if publicSpend is nonzero, check that `pubEncodedAssetId` matches `encodedAssetId`
    // otherwise, assert that `pubEncodedAssetId` is also zero
    pubEncodedAssetId === (1 - publicSpendIsZero) * encodedAssetId;

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
    commitmentTreeRoot <== MerkleTreeInclusionProof(levels)(oldNoteACommitment, pathA, siblingsA);

    // merkle tree inclusion proof for oldNoteBCommitment
    signal commitmentTreeRootB <== MerkleTreeInclusionProof(levels)(oldNoteBCommitment, pathB, siblingsB);
    // check that either oldNoteBCommitment is a 'dummy' note or it's in the tree
    // check that one of the following is true:
    //  1. oldNoteBValue is 0 (dummy note)
    //  2. commitmentTreeRootB is equal to commitmentTreeRoot
    oldNoteBValue * (commitmentTreeRoot - commitmentTreeRootB) === 0;

    // derive nullifier for oldNoteA
    nullifierA <== Poseidon(2)([oldNoteACommitment, vk]);

    // derive nullifier for oldNoteB
    nullifierB <== Poseidon(2)([oldNoteBCommitment, vk]);

    // check that new note values are in range [0, 2**252)
    BitRange(252)(newNoteAValue);
    BitRange(252)(newNoteBValue);

    // check that old note values are in range [0, 2**252]
    BitRange(252)(oldNoteAValue);
    BitRange(252)(oldNoteBValue);

    // check that old note owner addresses correspond to user's viewing key 
    VKIntegrity()(oldNoteAOwnerH1X, oldNoteAOwnerH1Y, oldNoteAOwnerH2X, oldNoteAOwnerH2Y, viewKeyBits);
    VKIntegrity()(oldNoteBOwnerH1X, oldNoteBOwnerH1Y, oldNoteBOwnerH2X, oldNoteBOwnerH2Y, viewKeyBits);

    // derive spending public key
    signal derivedViewKey <== Poseidon(3)([spendPubkey[0], spendPubkey[1], vkNonce]);
    vk === derivedViewKey;

    // check spend signature
    SigVerify()(spendPubkey, operationDigest, [c, z]);

    // deterministically derive nonce for outgoing notes
    signal newNoteANonce <== Poseidon(2)([vk, nullifierA]);
    signal newNoteBNonce <== Poseidon(2)([vk, nullifierB]);

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

    // compress the two points of the refund addr.
    // connect the y cordinates to the output signals
    // and assert that the sign bits match what was given in `pubEncodedAssetAddrWithSignBits`
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

    // hash the sender's canon addr as `Poseidon4(keccak256("SENDER_COMMITMENT") % p, senderCanonAddrX, senderCanonAddrY, newNoteBNonce)`
    var SENDER_COMMITMENT_DOMAIN_SEPARATOR = 5680996188676417870015190585682285899130949254168256752199352013418366665222;
    senderCommitment <== Poseidon(4)([SENDER_COMMITMENT_DOMAIN_SEPARATOR, senderCanonAddr[0], senderCanonAddr[1], newNoteBNonce]);
}

component main { public [pubEncodedAssetAddrWithSignBits, pubEncodedAssetId, operationDigest, refundAddrH1CompressedY, refundAddrH2CompressedY] } = JoinSplit(16);
