//@ts-ignore
import * as snarkjs from "snarkjs";

import {
  JoinSplitInputs,
  JoinSplitProofWithPublicSignals,
  JoinSplitProver,
  StealthAddressTrait,
  VerifyingKey,
  decomposeCompressedPoint,
} from "@nocturne-xyz/sdk";

export class WasmJoinSplitProver implements JoinSplitProver {
  wasmPath: string;
  zkeyPath: string;
  vkey: VerifyingKey;

  constructor(wasmPath: string, zkeyPath: string, vkey: VerifyingKey) {
    this.wasmPath = wasmPath;
    this.zkeyPath = zkeyPath;
    this.vkey = vkey;
  }

  async proveJoinSplit(
    inputs: JoinSplitInputs
  ): Promise<JoinSplitProofWithPublicSignals> {
    const {
      vk,
      vkNonce,
      spendPk,
      operationDigest,
      c,
      z,
      oldNoteA,
      oldNoteB,
      merkleProofA,
      merkleProofB,
      newNoteA,
      newNoteB,
      refundAddr,
      encodedAssetAddrWithSignBitsPub,
    } = inputs;

    const [, refundAddrH1CompressedY] = decomposeCompressedPoint(refundAddr.h1);
    const [, refundAddrH2CompressedY] = decomposeCompressedPoint(refundAddr.h2);
    const decompressedRefundAddr = StealthAddressTrait.decompress(refundAddr);

    const signals = {
      userViewKey: vk,

      spendPubKey: spendPk,
      userViewKeyNonce: vkNonce,

      operationDigest,

      refundAddrH1CompressedY,
      refundAddrH2CompressedY,

      refundAddrH1X: decompressedRefundAddr.h1X,
      refundAddrH1Y: decompressedRefundAddr.h1Y,
      refundAddrH2X: decompressedRefundAddr.h2X,
      refundAddrH2Y: decompressedRefundAddr.h2Y,

      c,
      z,

      // TODO: when publicSpend is 0, mask pub asset info to 0
      encodedAssetAddrWithSignBitsPub,
      encodedAssetIdPub: oldNoteA.encodedAssetId,

      encodedAssetAddr: oldNoteA.encodedAssetAddr,
      encodedAssetId: oldNoteA.encodedAssetId,

      oldNoteAOwnerH1X: oldNoteA.owner.h1X,
      oldNoteAOwnerH1Y: oldNoteA.owner.h1Y,
      oldNoteAOwnerH2X: oldNoteA.owner.h2X,
      oldNoteAOwnerH2Y: oldNoteA.owner.h2Y,
      oldNoteANonce: oldNoteA.nonce,
      oldNoteAValue: oldNoteA.value,

      pathA: merkleProofA.path,
      siblingsA: merkleProofA.siblings,

      oldNoteBOwnerH1X: oldNoteB.owner.h1X,
      oldNoteBOwnerH1Y: oldNoteB.owner.h1Y,
      oldNoteBOwnerH2X: oldNoteB.owner.h2X,
      oldNoteBOwnerH2Y: oldNoteB.owner.h2Y,
      oldNoteBNonce: oldNoteB.nonce,
      oldNoteBValue: oldNoteB.value,

      pathB: merkleProofB.path,
      siblingsB: merkleProofB.siblings,

      newNoteAValue: newNoteA.value,

      receiverCanonAddr: [newNoteB.owner.h2X, newNoteB.owner.h2Y],
      newNoteBValue: newNoteB.value,
    };

    const proof = await snarkjs.groth16.fullProve(
      signals,
      this.wasmPath,
      this.zkeyPath
    );

    return proof;
  }

  async verifyJoinSplitProof({
    proof,
    publicSignals,
  }: JoinSplitProofWithPublicSignals): Promise<boolean> {
    return await snarkjs.groth16.verify(this.vkey, publicSignals, proof);
  }
}
