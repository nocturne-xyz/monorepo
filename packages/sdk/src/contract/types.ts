import { Address } from "../commonTypes";
import { NocturneAddressStruct } from "../crypto/address";
import { JoinSplitInputs } from "../proof/joinsplit";
import { MerkleProofInput } from "../proof";
import {
  IncludedNote,
  Note,
  EncappedKey,
  EncryptedNote,
} from "../sdk/note";

export interface SpendAndRefundTokens {
  spendTokens: Address[];
  refundTokens: Address[];
}

export interface Action {
  contractAddress: Address;
  encodedFunction: string;
}

export interface BaseJoinSplitTx {
  commitmentTreeRoot: bigint;
  nullifierA: bigint;
  nullifierB: bigint;
  newNoteACommitment: bigint;
  newNoteAOwner: NocturneAddressStruct;
  encappedKeyA: EncappedKey;
  encryptedNoteA: EncryptedNote;
  newNoteBCommitment: bigint;
  newNoteBOwner: NocturneAddressStruct;
  encappedKeyB: EncappedKey;
  encryptedNoteB: EncryptedNote;
  asset: Address;
  id: bigint;
  publicSpend: bigint;
}

export interface PreSignJoinSplitTx extends BaseJoinSplitTx {
  oldNoteA: IncludedNote;
  oldNoteB: IncludedNote;
  newNoteA: Note;
  newNoteB: Note;
  merkleInputA: MerkleProofInput;
  merkleInputB: MerkleProofInput;
}

export interface PreProofJoinSplitTx extends BaseJoinSplitTx {
  opDigest: bigint;
  proofInputs: JoinSplitInputs
}

export interface ProvenJoinSplitTx extends BaseJoinSplitTx {
  proof: [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint];
}

export interface PreSignOperation {
  joinSplitTxs: PreSignJoinSplitTx[];
  refundAddr: NocturneAddressStruct;
  tokens: SpendAndRefundTokens;
  actions: Action[];
  gasLimit: bigint;
}

export interface PreProofOperation {
  joinSplitTxs: PreProofJoinSplitTx[];
  refundAddr: NocturneAddressStruct;
  tokens: SpendAndRefundTokens;
  actions: Action[];
  gasLimit: bigint;
}

export interface ProvenOperation {
  joinSplitTxs: ProvenJoinSplitTx[];
  refundAddr: NocturneAddressStruct;
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
  depositAddr: NocturneAddressStruct;
}
