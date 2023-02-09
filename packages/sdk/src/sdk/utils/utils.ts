import {
  PreProofOperation,
  PreSignOperation,
  ProvenOperation,
  SolidityProof,
} from "../../commonTypes";
import { JoinSplitRequest } from "../operationRequest";

export function getJoinSplitRequestTotalValue(
  joinSplitRequest: JoinSplitRequest
): bigint {
  let totalVal = joinSplitRequest.unwrapValue;
  if (joinSplitRequest.payment !== undefined) {
    totalVal += joinSplitRequest.payment.value;
  }
  return totalVal;
}

export function fakeProvenOperation(
  op: PreSignOperation | PreProofOperation | ProvenOperation
): ProvenOperation {
  const provenJoinSplits = op.joinSplits.map((joinSplit) => {
    return {
      commitmentTreeRoot: joinSplit.commitmentTreeRoot,
      nullifierA: joinSplit.nullifierA,
      nullifierB: joinSplit.nullifierB,
      newNoteACommitment: joinSplit.newNoteACommitment,
      newNoteBCommitment: joinSplit.newNoteBCommitment,
      encodedAsset: joinSplit.encodedAsset,
      publicSpend: joinSplit.publicSpend,
      newNoteAEncrypted: joinSplit.newNoteAEncrypted,
      newNoteBEncrypted: joinSplit.newNoteBEncrypted,
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
    joinSplits: provenJoinSplits,
  };
}

export function range(start: number, stop?: number, step?: number): number[] {
  if (!stop) {
    stop = start;
    start = 0;
  }

  step ??= 1;

  return Array(Math.ceil((stop - start) / step))
    .fill(start)
    .map((x, i) => x + i * (step as number));
}

export function groupBy<T>(list: T[], keyGetter: (item: T) => string): T[][] {
  const map = new Map();
  list.forEach((item) => {
    const key = keyGetter(item);
    const collection = map.get(key);
    if (!collection) {
      map.set(key, [item]);
    } else {
      collection.push(item);
      map.set(key, collection);
    }
  });

  return Array.from(map.values());
}
