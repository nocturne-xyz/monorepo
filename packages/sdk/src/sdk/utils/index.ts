import {
  JoinSplitRequest,
  PreProofOperation,
  PreSignOperation,
  ProvenOperation,
  SolidityProof,
} from "../../commonTypes";

export * from "./bits";
export * from "./ethers";

export function getJoinSplitRequestTotalValue(
  joinSplitRequest: JoinSplitRequest
): bigint {
  let totalVal = joinSplitRequest.unwrapValue;
  if (joinSplitRequest.paymentIntent !== undefined) {
    totalVal += joinSplitRequest.paymentIntent.value;
  }
  return totalVal;
}

export function fakeProvenOp(
  op: PreSignOperation | PreProofOperation | ProvenOperation
): ProvenOperation {
  const provenJoinSplitTxs = op.joinSplitTxs.map((joinSplitTx) => {
    const {
      commitmentTreeRoot,
      nullifierA,
      nullifierB,
      newNoteACommitment,
      newNoteBCommitment,
      encodedAssetAddr,
      encodedAssetId,
      publicSpend,
      newNoteATransmission,
      newNoteBTransmission,
    } = joinSplitTx;
    return {
      commitmentTreeRoot,
      nullifierA,
      nullifierB,
      newNoteACommitment,
      newNoteBCommitment,
      encodedAssetAddr,
      encodedAssetId,
      publicSpend,
      newNoteATransmission,
      newNoteBTransmission,
      proof: [0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n] as SolidityProof,
    };
  });
  const {
    refundAddr,
    encodedRefundAssets,
    actions,
    verificationGasLimit,
    executionGasLimit,
    maxNumRefunds,
    gasPrice,
  } = op;
  return {
    refundAddr,
    encodedRefundAssets,
    actions,
    verificationGasLimit,
    executionGasLimit,
    maxNumRefunds,
    gasPrice,
    joinSplitTxs: provenJoinSplitTxs,
  };
}
