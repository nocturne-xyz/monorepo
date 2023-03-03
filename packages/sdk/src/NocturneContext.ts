import {
  SignedOperation,
  PreSignOperation,
  AssetWithBalance,
} from "./primitives";
import { NocturneSigner } from "./crypto";
import { MerkleProver } from "./merkleProver";
import { OpPreparer } from "./opPreparer";
import { OperationRequest } from "./operationRequest";
import { NocturneDB } from "./NocturneDB";
import { Wallet, Wallet__factory } from "@nocturne-xyz/contracts";
import { ethers } from "ethers";
import { OpSigner } from "./opSigner";
import { loadNocturneConfig, NocturneConfig } from "@nocturne-xyz/config";
import { SyncAdapter } from "./sync";
import { NocturneSyncer } from "./NocturneSyncer";

export class NocturneContext {
  private opPreparer: OpPreparer;
  private opSigner: OpSigner;
  private syncer: NocturneSyncer;

  protected walletContract: Wallet;
  protected merkleProver: MerkleProver;
  protected db: NocturneDB;

  readonly signer: NocturneSigner;

  constructor(
    signer: NocturneSigner,
    provider: ethers.providers.Provider,
    configOrNetworkName: NocturneConfig | string,
    merkleProver: MerkleProver,
    db: NocturneDB,
    syncAdapter: SyncAdapter
  ) {
    let config: NocturneConfig;
    if (typeof configOrNetworkName == "string") {
      config = loadNocturneConfig(configOrNetworkName);
    } else {
      config = configOrNetworkName;
    }

    this.signer = signer;
    this.walletContract = Wallet__factory.connect(
      config.walletAddress(),
      provider
    );
    this.merkleProver = merkleProver;
    this.db = db;

    this.opPreparer = new OpPreparer(
      this.db,
      this.merkleProver,
      this.signer,
      this.walletContract,
      config.gasAssets
    );

    this.opSigner = new OpSigner(this.signer);

    this.syncer = new NocturneSyncer(
      this.signer,
      syncAdapter,
      this.db,
      this.merkleProver,
      provider
    );
  }

  async sync(): Promise<void> {
    await this.syncer.sync();
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
      const asset = NocturneDB.parseAssetKey(assetString);
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
