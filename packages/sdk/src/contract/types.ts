import { FlaxAddressInput } from "../proof/spend2";

type Address = string;
type FLAXAddress = FlaxAddressInput;

export interface Note {
  owner: FLAXAddress;
  nonce: bigint;
  type: Address;
  id: bigint;
  value: bigint;
}

export interface Tokens {
  spendTokens: Address[];
  refundTokens: Address[];
}

export interface Action {
  contractAddress: Address;
  encodedFunction: string;
}

export interface UnprovenSpendTransaction {
  commitmentTreeRoot: bigint;
  nullifier: bigint;
  newNoteCommitment: bigint;
  asset: Address;
  value: bigint;
  id: bigint;
}

export interface UnprovenOperation {
  refundAddr: FLAXAddress;
  tokens: Tokens;
  actions: Action[];
  gasLimit: bigint;
}

export interface ProvenSpendTransaction {
  commitmentTreeRoot: bigint;
  nullifier: bigint;
  newNoteCommitment: bigint;
  proof: [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint];
  asset: Address;
  value: bigint;
  id: bigint;
}

export interface ProvenOperation {
  spendTxs: ProvenSpendTransaction[];
  refundAddr: FLAXAddress;
  tokens: Tokens;
  actions: Action[];
  gasLimit: bigint;
}

export interface Bundle {
  operations: ProvenOperation[];
}

export interface Deposit {
  spender: Address;
  asset: Address;
  value: bigint;
  id: bigint;
  depositAddr: FLAXAddress;
}
