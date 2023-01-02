import { Address, ProvenOperation } from "../commonTypes";
import { NocturneAddress } from "../crypto/address";

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
  depositAddr: NocturneAddress;
}
