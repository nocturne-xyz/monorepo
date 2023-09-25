import { Address } from "@nocturne-xyz/core";
import { DepositHandle, DisplayDepositRequestWithMetadataAndStatus } from "../types";

export interface DepositAdapter {
  fetchDepositRequestsBySpender(spender: Address): Promise<DepositHandle[]>;
  makeDepositHandle(requestWithOnChainStatus: DisplayDepositRequestWithMetadataAndStatus): Promise<DepositHandle>;
}
