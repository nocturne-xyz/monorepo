import {
  SignedOperation,
  PreSignOperation,
  AssetWithBalance,
} from "./primitives";
import { NocturneSigner } from "./crypto";
import { handleGasForOperationRequest } from "./opRequestGas";
import { prepareOperation } from "./prepareOperation";
import { OperationRequest } from "./operationRequest";
import { NocturneDB } from "./NocturneDB";
import { Handler, Handler__factory } from "@nocturne-xyz/contracts";
import { ethers } from "ethers";
import { signOperation } from "./signOperation";
import { loadNocturneConfig, NocturneConfig } from "@nocturne-xyz/config";
import { Asset, AssetTrait } from "./primitives/asset";
import { SDKSyncAdapter } from "./sync";
import { syncSDK } from "./syncSDK";
import { getJoinSplitRequestTotalValue } from "./utils";
import { SparseMerkleProver } from "./SparseMerkleProver";
import { EthToTokenConverter } from "./conversion";
import { getCreationTimestampOfNewestNoteInOp } from "./timestampOfNewestNoteInOp";

export class NocturneWalletSDK {
  protected config: NocturneConfig;
  protected handlerContract: Handler;
  protected merkleProver: SparseMerkleProver;
  protected db: NocturneDB;
  protected syncAdapter: SDKSyncAdapter;
  protected tokenConverter: EthToTokenConverter;

  readonly signer: NocturneSigner;
  readonly gasAssets: Map<string, Asset>;

  constructor(
    signer: NocturneSigner,
    provider: ethers.providers.Provider,
    configOrNetworkName: NocturneConfig | string,
    merkleProver: SparseMerkleProver,
    db: NocturneDB,
    syncAdapter: SDKSyncAdapter,
    tokenConverter: EthToTokenConverter
  ) {
    if (typeof configOrNetworkName == "string") {
      this.config = loadNocturneConfig(configOrNetworkName);
    } else {
      this.config = configOrNetworkName;
    }

    this.gasAssets = new Map(
      Array.from(this.config.erc20s.entries())
        .filter(([_, config]) => config.isGasAsset)
        .map(([ticker, config]) => {
          return [ticker, AssetTrait.erc20AddressToAsset(config.address)];
        })
    );

    this.signer = signer;
    this.handlerContract = Handler__factory.connect(
      this.config.handlerAddress(),
      provider
    );
    this.merkleProver = merkleProver;
    this.db = db;
    this.syncAdapter = syncAdapter;
    this.tokenConverter = tokenConverter;
  }

  async sync(): Promise<void> {
    const deps = {
      provider: this.handlerContract.provider,
      viewer: this.signer,
    };
    await syncSDK(deps, this.syncAdapter, this.db, this.merkleProver, {
      startBlock: this.config.contracts.startBlock,
    });
  }

  async prepareOperation(
    opRequest: OperationRequest
  ): Promise<PreSignOperation> {
    const deps = {
      db: this.db,
      gasAssets: this.gasAssets,
      tokenConverter: this.tokenConverter,
      handlerContract: this.handlerContract,
      merkle: this.merkleProver,
      viewer: this.signer,
    };

    const gasAccountedOpRequest = await handleGasForOperationRequest(
      deps,
      opRequest
    );
    return await prepareOperation(deps, gasAccountedOpRequest);
  }

  signOperation(preSignOperation: PreSignOperation): SignedOperation {
    return signOperation(this.signer, preSignOperation);
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

  async getAllCommittedAssetBalances(): Promise<AssetWithBalance[]> {
    const notes = await this.db.getAllCommittedNotes();
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
    for (const joinSplitRequest of opRequest.joinSplitRequests) {
      const requestedAmount = getJoinSplitRequestTotalValue(joinSplitRequest);
      // check that the user has enough committed notes to cover the request
      const notes = await this.db.getCommittedNotesForAsset(
        joinSplitRequest.asset
      );
      const balance = notes.reduce((acc, note) => acc + note.value, 0n);
      if (balance < requestedAmount) {
        return false;
      }
    }

    return true;
  }

  async getCreationTimestampOfNewestNoteInOp(
    op: PreSignOperation | SignedOperation
  ): Promise<number> {
    return await getCreationTimestampOfNewestNoteInOp(this.db, op);
  }
}
