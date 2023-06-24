import {
  SignedOperation,
  PreSignOperation,
  AssetWithBalance,
  OptimisticNFRecord,
  computeOperationDigest,
  OperationMetadata,
  OpDigestWithMetadata,
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
import { SDKSyncAdapter, TotalEntityIndexTrait } from "./sync";
import { syncSDK } from "./syncSDK";
import { getJoinSplitRequestTotalValue, unzip } from "./utils";
import { SparseMerkleProver } from "./SparseMerkleProver";
import { EthToTokenConverter } from "./conversion";
import { getMerkleIndicesAndNfsFromOp } from "./utils/misc";
import { OpTracker } from "./OpTracker";
import { getTotalEntityIndexOfNewestNoteInOp } from "./totalEntityIndexOfNewestNoteInOp";
import { Logger } from "winston";

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
  protected opTracker: OpTracker;

  readonly signer: NocturneSigner;
  readonly gasAssets: Map<string, Asset>;
  readonly logger?: Logger;

  constructor(
    signer: NocturneSigner,
    provider: ethers.providers.Provider,
    configOrNetworkName: NocturneConfig | string,
    merkleProver: SparseMerkleProver,
    db: NocturneDB,
    syncAdapter: SDKSyncAdapter,
    tokenConverter: EthToTokenConverter,
    nulliferChecker: OpTracker,
    logger?: Logger
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
    this.opTracker = nulliferChecker;
    this.logger = logger;
  }

  async sync(): Promise<void> {
    await syncSDK(
      { viewer: this.signer },
      this.syncAdapter,
      this.db,
      this.merkleProver
    );
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
      logger: this.logger,
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
    const assetRequestedAmounts = new Map<Asset, bigint>();
    for (const joinSplitRequest of opRequest.joinSplitRequests) {
      const asset = joinSplitRequest.asset;
      let currentAmount = assetRequestedAmounts.get(asset) || 0n;
      currentAmount += getJoinSplitRequestTotalValue(joinSplitRequest);
      assetRequestedAmounts.set(asset, currentAmount);
    }

    for (const [asset, requestedAmount] of assetRequestedAmounts.entries()) {
      const balance = await this.db.getBalanceForAsset(asset);
      if (balance < requestedAmount) {
        return false;
      }
    }

    return true;
  }

  async getCreationBlockOfNewestNoteInOp(
    op: PreSignOperation | SignedOperation
  ): Promise<number> {
    const totalEntityIndex = await getTotalEntityIndexOfNewestNoteInOp(
      this.db,
      op
    );
    return Number(
      TotalEntityIndexTrait.toComponents(totalEntityIndex).blockNumber
    );
  }

  async applyOptimisticRecordsForOp(
    op: PreSignOperation | SignedOperation,
    metadata?: OperationMetadata
  ): Promise<void> {
    // Create op digest record
    const opDigest = computeOperationDigest(op);
    const expirationDate = Date.now() + OPTIMISTIC_RECORD_TTL;

    // Create NF records
    const [merkleIndices, nfRecords] = unzip(
      getMerkleIndicesAndNfsFromOp(op).map(({ merkleIndex, nullifier }) => {
        return [
          Number(merkleIndex),
          {
            nullifier,
          } as OptimisticNFRecord,
        ];
      })
    );

    this.logger?.info(
      `Storing optimistic record for op ${opDigest}. Op description: ${metadata?.description}`
    );
    this.logger &&
      this.logger?.info(
        `Storing optimistic record for op ${opDigest}. Description: ${metadata?.description}`
      );
    await this.db.storeOptimisticRecords(
      opDigest,
      {
        expirationDate,
        merkleIndices,
        metadata,
      },
      nfRecords
    );
  }

  async getAllOptimisticOpDigestsWithMetadata(): Promise<
    OpDigestWithMetadata[]
  > {
    const optimisticOpDigestRecords =
      await this.db.getAllOptimisticOpDigestRecords();
    return Array.from(optimisticOpDigestRecords).map(([opDigest, record]) => {
      return { opDigest, metadata: record.metadata };
    });
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
      if (!(await this.opTracker.operationIsInFlight(opDigest))) {
        opDigestsToRemove.add(opDigest);
      }
    }

    await this.db.removeOptimisticRecordsForOpDigests(
      Array.from(opDigestsToRemove)
    );
  }
}
