import { Address } from "../commonTypes";
import { AnonAddressStruct } from "../crypto/address";

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

export interface PreProofJoinsplitTransaction {
  commitmentTreeRoot: bigint;
  nullifierA: bigint;
  nullifierB: bigint;
  newNoteACommitment: bigint;
  newNoteBCommitment: bigint;
  asset: Address;
  id: bigint;
  publicSpend: bigint;
}

export interface PreProofOperation {
  joinsplitTxs: PreProofJoinsplitTransaction[];
  refundAddr: AnonAddressStruct;
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

export interface PostProofJoinsplitTransaction {
  commitmentTreeRoot: bigint;
  nullifierA: bigint;
  nullifierB: bigint;
  newNoteACommitment: bigint;
  newNoteBCommitment: bigint;
  asset: Address;
  id: bigint;
  publicSpend: bigint;
  proof: [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint];
}


export interface PostProofOperation {
  joinsplitTxs: PostProofJoinsplitTransaction[];
  refundAddr: AnonAddressStruct;
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
  depositAddr: AnonAddressStruct;
}
