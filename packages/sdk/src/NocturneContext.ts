import {
  SignedOperation,
  Address,
  PreSignOperation,
  AssetWithBalance,
  NocturneSigner,
} from "@nocturne-xyz/primitives";
import { NotesManager } from "./notesManager";
import { MerkleProver, InMemoryMerkleProver } from "./merkleProver";
import { OpPreparer } from "./opPreparer";
import { OperationRequest } from "./operationRequest";
import { NotesDB } from "./db";
import { Wallet, Wallet__factory } from "@nocturne-xyz/contracts";
import { ethers } from "ethers";
import { OpSigner } from "./opSigner";

export class NocturneContext {
  readonly signer: NocturneSigner;
  protected merkleProver: MerkleProver;
  protected notesManager: NotesManager;
  protected walletContract: Wallet;
  readonly db: NotesDB;

  private opPreparer: OpPreparer;
  private opSigner: OpSigner;

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

    this.opPreparer = new OpPreparer(
      this.db,
      this.merkleProver,
      this.signer,
      this.walletContract
    );

    this.opSigner = new OpSigner(this.signer);
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

  async prepareOperation(
    opRequest: OperationRequest
  ): Promise<PreSignOperation> {
    return await this.opPreparer.prepareOperation(opRequest);
  }

  signOperation(preSignOperation: PreSignOperation): SignedOperation {
    return this.opSigner.signOperation(preSignOperation);
  }

  async getAllAssetBalances(): Promise<AssetWithBalance[]> {
    const notes = await this.db.getAllNotes();
    return Array.from(notes.entries()).map(([assetString, notes]) => {
      const asset = NotesDB.parseAssetFromNoteAssetKey(assetString);
      const balance = notes.reduce((a, b) => a + b.value, 0n);
      return {
        asset,
        balance,
      };
    });
  }

  async hasEnoughBalanceForOperationRequest(
    opRequest: OperationRequest
  ): Promise<boolean> {
    return this.opPreparer.hasEnoughBalanceForOperationRequest(opRequest);
  }
}
