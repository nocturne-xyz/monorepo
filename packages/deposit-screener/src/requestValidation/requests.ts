import { Address } from "@nocturne-xyz/sdk";

export interface QuoteRequest {
  spender: Address;
  assetAddr: Address;
  value: bigint;
}
