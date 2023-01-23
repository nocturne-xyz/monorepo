import {
  JoinSplitRequest,
  PreProofOperation,
  PreSignOperation,
  ProvenOperation,
  SolidityProof,
} from "../../commonTypes";

export function getJoinSplitRequestTotalValue(
  joinSplitRequest: JoinSplitRequest
): bigint {
  let totalVal = joinSplitRequest.unwrapValue;
  if (joinSplitRequest.paymentIntent !== undefined) {
    totalVal += joinSplitRequest.paymentIntent.value;
  }
  return totalVal;
}

export function fakeProvenOperation(
  op: PreSignOperation | PreProofOperation | ProvenOperation
): ProvenOperation {
  const provenJoinSplitTxs = op.joinSplitTxs.map((joinSplitTx) => {
    return {
      commitmentTreeRoot: joinSplitTx.commitmentTreeRoot,
      nullifierA: joinSplitTx.nullifierA,
      nullifierB: joinSplitTx.nullifierB,
      newNoteACommitment: joinSplitTx.newNoteACommitment,
      newNoteBCommitment: joinSplitTx.newNoteBCommitment,
      encodedAsset: joinSplitTx.encodedAsset,
      publicSpend: joinSplitTx.publicSpend,
      newNoteATransmission: joinSplitTx.newNoteATransmission,
      newNoteBTransmission: joinSplitTx.newNoteBTransmission,
      proof: [0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n] as SolidityProof,
    };
  });
  return {
    refundAddr: op.refundAddr,
    encodedRefundAssets: op.encodedRefundAssets,
    actions: op.actions,
    verificationGasLimit: op.verificationGasLimit,
    executionGasLimit: op.executionGasLimit,
    maxNumRefunds: op.maxNumRefunds,
    gasPrice: op.gasPrice,
    joinSplitTxs: provenJoinSplitTxs,
  };
}
