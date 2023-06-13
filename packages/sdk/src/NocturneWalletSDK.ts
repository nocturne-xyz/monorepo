import {
  SignedOperation,
  PreSignOperation,
  AssetWithBalance,
  OptimisticNFRecord,
  computeOperationDigest,
} from "./primitives";
import { NocturneSigner } from "./crypto";
import { handleGasForOperationRequest } from "./opRequestGas";
import { prepareOperation } from "./prepareOperation";
import { OperationRequest, ensureOpRequestChainInfo } from "./operationRequest";
import { GetNotesOpts, NocturneDB } from "./NocturneDB";
import { Handler, Handler__factory } from "@nocturne-xyz/contracts";
import { ethers } from "ethers";
import { signOperation } from "./signOperation";
import { loadNocturneConfig, NocturneConfig } from "@nocturne-xyz/config";
import { Asset, AssetTrait } from "./primitives/asset";
import { SDKSyncAdapter } from "./sync";
import { syncSDK } from "./syncSDK";
import { getJoinSplitRequestTotalValue, unzip } from "./utils";
import { SparseMerkleProver } from "./SparseMerkleProver";
import { EthToTokenConverter } from "./conversion";
import { getMerkleIndicesAndNfsFromOp } from "./utils/misc";
import { OpDigestChecker } from "./OpDigestChecker";
import { getCreationTimestampOfNewestNoteInOp } from "./timestampOfNewestNoteInOp";

// 10 minutes
const OPTIMISTIC_RECORD_TTL: number = 10 * 60 * 1000;

export class NocturneWalletSDK {
  protected provider: ethers.providers.Provider;
  protected config: NocturneConfig;
  protected handlerContract: Handler;
  protected merkleProver: SparseMerkleProver;
  protected db: NocturneDB;
  protected syncAdapter: SDKSyncAdapter;
  protected tokenConverter: EthToTokenConverter;
  protected opDigestChecker: OpDigestChecker;

  readonly signer: NocturneSigner;
  readonly gasAssets: Map<string, Asset>;

  constructor(
    signer: NocturneSigner,
    provider: ethers.providers.Provider,
    configOrNetworkName: NocturneConfig | string,
    merkleProver: SparseMerkleProver,
    db: NocturneDB,
    syncAdapter: SDKSyncAdapter,
    tokenConverter: EthToTokenConverter,
    nulliferChecker: OpDigestChecker
  ) {
    if (typeof configOrNetworkName == "string") {
      this.config = loadNocturneConfig(configOrNetworkName);
    } else {
      this.config = configOrNetworkName;
    }

    this.provider = provider;

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
    this.opDigestChecker = nulliferChecker;
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
    opRequest = await ensureOpRequestChainInfo(opRequest, this.provider);

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

  async getAllAssetBalances(opts?: GetNotesOpts): Promise<AssetWithBalance[]> {
    const notes = await this.db.getAllNotes(opts);
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
      const notes = await this.db.getNotesForAsset(joinSplitRequest.asset);
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

  async applyOptimisticNullifiersForOp(
    op: PreSignOperation | SignedOperation
  ): Promise<void> {
    // Create op digest record
    const opDigest = computeOperationDigest(op);
    const expirationDate = Date.now() + OPTIMISTIC_RECORD_TTL;

    // Create NF records
    const [merkleIndices, records] = unzip(
      getMerkleIndicesAndNfsFromOp(op).map(({ merkleIndex, nullifier }) => {
        return [
          Number(merkleIndex),
          {
            nullifier,
          } as OptimisticNFRecord,
        ];
      })
    );

    await this.db.storeOptimisticRecords(
      opDigest,
      { expirationDate, merkleIndices, metadata: { description: "" } },
      merkleIndices,
      records
    );
  }

  async updateOptimisticNullifiers(): Promise<void> {
    const optimisticOpDigestRecords =
      await this.db.getAllOptimisticOpDigestRecords();

    // get all of merkle indices of records we want to remove
    const opDigestsToRemove = new Set<bigint>();
    for (const [opDigest, record] of optimisticOpDigestRecords.entries()) {
      // if it's expired, remove it
      if (Date.now() > record.expirationDate) {
        opDigestsToRemove.add(opDigest);
        continue;
      }

      // if bundler doesn't have the nullifier in its DB, remove its
      // OptimisticNFRecord
      if (!(await this.opDigestChecker.operationIsInFlight(opDigest))) {
        opDigestsToRemove.add(opDigest);
      }
    }

    await this.db.removeOptimisticRecordsForOpDigests(
      Array.from(opDigestsToRemove)
    );
  }
}
