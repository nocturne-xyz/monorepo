import { Action, JoinSplitRequest } from "@nocturne-xyz/sdk";

export interface ExtendedAction {
  action: Action;
  signature: string;
}

export interface ExtendedJoinSplitRequest {
  joinSplitRequest: JoinSplitRequest;
  decimals: number;
}
