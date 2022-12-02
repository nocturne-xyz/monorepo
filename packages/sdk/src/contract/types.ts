import { Address, ProvenOperation } from "../commonTypes";
import { NocturneAddressStruct } from "../crypto/address";

export interface SpendAndRefundTokens {
  spendTokens: Address[];
  refundTokens: Address[];
}

export interface Action {
  contractAddress: Address;
  encodedFunction: string;
}

export interface Bundle {
  operations: ProvenOperation[];
}

export interface Deposit {
  spender: Address;
  asset: Address;
  value: bigint;
  id: bigint;
  depositAddr: NocturneAddressStruct;
}
