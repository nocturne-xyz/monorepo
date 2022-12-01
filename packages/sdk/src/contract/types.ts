import { Address } from "../commonTypes";
import { NocturneAddress } from "../crypto/address";

export interface SpendAndRefundTokens {
  spendTokens: Address[];
  refundTokens: Address[];
}

export interface Action {
  contractAddress: Address;
  encodedFunction: string;
}

export interface PreProofSpendTx {
  commitmentTreeRoot: bigint;
  nullifier: bigint;
  newNoteCommitment: bigint;
  asset: Address;
  id: bigint;
  valueToSpend: bigint;
}

export interface PreProofOperation {
  refundAddr: NocturneAddress;
  tokens: SpendAndRefundTokens;
  actions: Action[];
  gasLimit: bigint;
}

export interface ProvenSpendTx {
  commitmentTreeRoot: bigint;
  nullifier: bigint;
  newNoteCommitment: bigint;
  proof: [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint];
  asset: Address;
  valueToSpend: bigint;
  id: bigint;
}

export interface ProvenOperation {
  spendTxs: ProvenSpendTx[];
  refundAddr: NocturneAddress;
  tokens: SpendAndRefundTokens;
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
  depositAddr: NocturneAddress;
}
