import { SignedOperation, Address, PreSignOperation } from "./commonTypes";
import { NocturneSigner } from "./crypto";
import {
  AssetWithBalance,
  NotesManager,
  getJoinSplitRequestTotalValue,
  prepareOperation,
  OperationRequest,
  InMemoryMerkleProver,
  MerkleProver,
  hasEnoughBalance,
  NotesDB,
} from "./sdk";
import { Wallet, Wallet__factory } from "@nocturne-xyz/contracts";
import { ethers } from "ethers";

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

  async prepareOperation(
    opRequest: OperationRequest
  ): Promise<PreSignOperation> {
    return await prepareOperation(
      opRequest,
      this.db,
      this.merkleProver,
      this.signer,
      this.walletContract
    );
  }

  signOperation(preSignOperation: PreSignOperation): SignedOperation {
    return this.signer.signOperation(preSignOperation);
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
    for (const joinSplitRequest of opRequest.joinSplitRequests) {
      const requestedAmount = getJoinSplitRequestTotalValue(joinSplitRequest);
      if (
        !(await hasEnoughBalance(
          requestedAmount,
          joinSplitRequest.asset,
          this.db
        ))
      ) {
        return false;
      }
    }

    return true;
  }
}
