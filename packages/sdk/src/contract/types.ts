import { Address } from "../commonTypes";
import { FlaxAddressStruct } from "../crypto/address";

export interface Tokens {
  spendTokens: Address[];
  refundTokens: Address[];
}

export interface Action {
  contractAddress: Address;
  encodedFunction: string;
}

export interface PreProofSpendTransaction {
  commitmentTreeRoot: bigint;
  nullifier: bigint;
  newNoteCommitment: bigint;
  asset: Address;
  id: bigint;
  valueToSpend: bigint;
}

export interface PreProofOperation {
  refundAddr: FlaxAddressStruct;
  tokens: Tokens;
  actions: Action[];
  gasLimit: bigint;
}

export interface PostProofSpendTransaction {
  commitmentTreeRoot: bigint;
  nullifier: bigint;
  newNoteCommitment: bigint;
  proof: [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint];
  asset: Address;
  valueToSpend: bigint;
  id: bigint;
}

export interface PostProofOperation {
  spendTxs: PostProofSpendTransaction[];
  refundAddr: FlaxAddressStruct;
  tokens: Tokens;
  actions: Action[];
  gasLimit: bigint;
}

export interface Bundle {
  operations: PostProofOperation[];
}

export interface Deposit {
  spender: Address;
  asset: Address;
  value: bigint;
  id: bigint;
  depositAddr: FlaxAddressStruct;
}
