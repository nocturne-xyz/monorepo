import { Action, JoinSplitRequest } from "@nocturne-xyz/sdk";

export interface ActionWithSignature {
  action: Action;
  signature: string;
}

export interface JoinSplitRequestWithDecimals {
  joinSplitRequest: JoinSplitRequest;
  decimals: number;
}
