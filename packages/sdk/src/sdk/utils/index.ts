import { JoinSplitRequest } from "../../commonTypes";

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
