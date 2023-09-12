import { BN254ScalarField } from "@nocturne-xyz/crypto-utils";
import { decomposeCompressedPoint } from "../crypto";
import { CompressedStealthAddress } from "../crypto/address";
import { EncodedNote } from "../primitives";
import { BaseProof, MerkleProofInput } from "./types";
import * as ethers from "ethers";

export const JOINSPLIT_INFO_NONCE_DOMAIN_SEPARATOR = BN254ScalarField.reduce(
  BigInt(
    ethers.utils.keccak256(
      ethers.utils.toUtf8Bytes("JOINSPLIT_INFO_COMMITMENT")
    )
  )
);

export const JOINSPLIT_INFO_COMMITMENT_DOMAIN_SEPARATOR =
  BN254ScalarField.reduce(
    BigInt(
      ethers.utils.keccak256(ethers.utils.toUtf8Bytes("JOINSPLIT_INFO_NONCE"))
    )
  );

export interface JoinSplitProver {
  proveJoinSplit(
    inputs: JoinSplitInputs
  ): Promise<JoinSplitProofWithPublicSignals>;

  verifyJoinSplitProof({
    proof,
    publicSignals,
  }: JoinSplitProofWithPublicSignals): Promise<boolean>;
}

export interface JoinSplitProofWithPublicSignals {
  proof: BaseProof;
  publicSignals: [
    bigint, // newNoteACommitment
    bigint, // newNoteBCommitment
    bigint, // commitmentTreeRoot
    bigint, // publicSpend
    bigint, // nullifierA
    bigint, // nullifierB
    bigint, // ssenderCommitment
    bigint, // joinSplitInfoCommitment
    bigint, // operationDigest
    bigint, // pubEncodedAssetId
    bigint, // pubEncodedAssetAddrWithSignBits
    bigint, // refundAddrH1CompressedY
    bigint // refundAddrH2CompressedY
  ];
}

export interface JoinSplitPublicSignals {
  newNoteACommitment: bigint;
  newNoteBCommitment: bigint;
  commitmentTreeRoot: bigint;
  publicSpend: bigint;
  nullifierA: bigint;
  nullifierB: bigint;
  opDigest: bigint;
  pubEncodedAssetAddrWithSignBits: bigint;
  pubEncodedAssetId: bigint;
  refundAddrH1CompressedY: bigint;
  refundAddrH2CompressedY: bigint;
  senderCommitment: bigint;
  joinSplitInfoCommitment: bigint;
}

export interface JoinSplitInputs {
  vk: bigint;
  vkNonce: bigint;
  spendPk: [bigint, bigint];
  operationDigest: bigint;
  c: bigint;
  z: bigint;
  oldNoteA: EncodedNote;
  oldNoteB: EncodedNote;
  merkleProofA: MerkleProofInput;
  merkleProofB: MerkleProofInput;
  newNoteA: EncodedNote;
  newNoteB: EncodedNote;
  refundAddr: CompressedStealthAddress;
  pubEncodedAssetAddrWithSignBits: bigint;
  pubEncodedAssetId: bigint;
}

export function joinSplitPublicSignalsFromArray(
  publicSignals: bigint[]
): JoinSplitPublicSignals {
  return {
    newNoteACommitment: publicSignals[0],
    newNoteBCommitment: publicSignals[1],
    commitmentTreeRoot: publicSignals[2],
    publicSpend: publicSignals[3],
    nullifierA: publicSignals[4],
    nullifierB: publicSignals[5],
    senderCommitment: publicSignals[6],
    joinSplitInfoCommitment: publicSignals[7],
    opDigest: publicSignals[8],
    pubEncodedAssetId: publicSignals[9],
    pubEncodedAssetAddrWithSignBits: publicSignals[10],
    refundAddrH1CompressedY: publicSignals[11],
    refundAddrH2CompressedY: publicSignals[12],
  };
}

export function joinSplitPublicSignalsToArray(
  publicSignals: JoinSplitPublicSignals
): [
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint
] {
  return [
    publicSignals.newNoteACommitment,
    publicSignals.newNoteBCommitment,
    publicSignals.commitmentTreeRoot,
    publicSignals.publicSpend,
    publicSignals.nullifierA,
    publicSignals.nullifierB,
    publicSignals.senderCommitment,
    publicSignals.joinSplitInfoCommitment,
    publicSignals.opDigest,
    publicSignals.pubEncodedAssetId,
    publicSignals.pubEncodedAssetAddrWithSignBits,
    publicSignals.refundAddrH1CompressedY,
    publicSignals.refundAddrH2CompressedY,
  ];
}

// encodedAssetAddr with the sign bits of the encrypted sender canon address placed at bits 248 and 249 (counting from LSB to MSB starting at 0)
export function encodeEncodedAssetAddrWithSignBitsPI(
  encodedAssetAddr: bigint,
  refundAddr: CompressedStealthAddress
): bigint {
  const [sign1] = decomposeCompressedPoint(refundAddr.h1);
  const [sign2] = decomposeCompressedPoint(refundAddr.h2);
  return encodedAssetAddr | (BigInt(sign1) << 248n) | (BigInt(sign2) << 249n);
}

export function encodeOldNoteMerkleIndicesWithSignBits(
  oldNoteAIndex: number,
  oldNoteBIndex: number,
  senderSign: boolean,
  receiverSign: boolean,
  oldNoteBIsDummy: boolean
): bigint {
  const receiverSignBit = receiverSign ? 1n : 0n;
  const senderSignBit = senderSign ? 1n : 0n;
  const oldNoteBIsDummyBit = oldNoteBIsDummy ? 1n : 0n;
  return (
    (oldNoteBIsDummyBit << 66n) |
    (receiverSignBit << 65n) |
    (senderSignBit << 64n) |
    (BigInt(oldNoteBIndex) << 32n) |
    BigInt(oldNoteAIndex)
  );
}
