import {
  PreProofOperation,
  Address,
  PreSignOperation,
} from "./commonTypes";
import {  OperationRequest } from "./sdk/operationRequest";
import { Note, IncludedNote } from "./sdk/note";
import { NocturneSigner } from "./sdk/signer";
import { InMemoryMerkleProver, MerkleProver } from "./sdk/merkleProver";
import { NotesDB } from "./sdk/db";
import {
  NotesManager,
  prepareOperation 
} from "./sdk";
import { Wallet, Wallet__factory } from "@nocturne-xyz/contracts";
import { ethers } from "ethers";

export interface JoinSplitNotes {
  oldNoteA: IncludedNote;
  oldNoteB: IncludedNote;
  newNoteA: Note;
  newNoteB: Note;
}

export class NocturneContext {
  readonly signer: NocturneSigner;
  protected merkleProver: MerkleProver;
  protected notesManager: NotesManager;
  protected walletContract: Wallet;
  readonly db: NotesDB;

  constructor(
    signer: NocturneSigner,
    provider: ethers.providers.Provider,
    walletContractAddress: Address,
    merkleProver: MerkleProver,
    notesManager: NotesManager,
    db: NotesDB
  ) {
    this.signer = signer;
    this.walletContract = Wallet__factory.connect(
      walletContractAddress,
      provider
    );
    this.merkleProver = merkleProver;
    this.notesManager = notesManager;
    this.db = db;
  }

  async syncNotes(): Promise<void> {
    await this.notesManager.fetchAndStoreNewNotesFromRefunds();
    await this.notesManager.fetchAndApplyNewJoinSplits();
  }

  async syncLeaves(): Promise<void> {
    if (this.merkleProver.isLocal()) {
      await (this.merkleProver as InMemoryMerkleProver).fetchLeavesAndUpdate();
    } else {
      throw Error("Attempted to sync leaves for non-local merkle prover");
    }
  }

  async prepareOperation(opRequest: OperationRequest): Promise<PreSignOperation> {
    return await prepareOperation(
      opRequest,
      this.db,
      this.merkleProver,
      this.signer,
      this.walletContract
    );
  }

  signOperation(preSignOperation: PreSignOperation): PreProofOperation {
    return this.signer.signOperation(preSignOperation);
  }
}
