import { NocturneConfig, loadNocturneConfig } from "@nocturne-xyz/config";
import { Handler, Handler__factory } from "@nocturne-xyz/contracts";
import { NocturneViewer } from "@nocturne-xyz/crypto";
import ethers from "ethers";
import { GetNotesOpts, NocturneDB } from "./NocturneDB";
import { OpTracker } from "./OpTracker";
import { EthToTokenConverter } from "./conversion";
import { handleGasForOperationRequest } from "./opRequestGas";
import {
  OperationRequest,
  ensureOpRequestChainInfo,
} from "./operationRequest/operationRequest";
import { prepareOperation } from "./prepareOperation";
import { SyncOpts, syncSDK } from "./syncSDK";
import { OpHistoryRecord, OperationMetadata } from "./types";
import {
  getJoinSplitRequestTotalValue,
  getMerkleIndicesAndNfsFromOp,
} from "./utils";

import {
  Asset,
  AssetTrait,
  AssetWithBalance,
  MapWithObjectKeys,
  OperationStatus,
  PreSignOperation,
  SDKSyncAdapter,
  SignedOperation,
  SparseMerkleProver,
  TotalEntityIndex,
  TotalEntityIndexTrait,
  maxArray,
} from "@nocturne-xyz/core";
import { NocturneClientState } from "./NocturneClientState";

const PRUNE_OPTIMISTIC_NFS_TIMER = 60 * 1000; // 1 minute

export class NocturneClient {
  protected provider: ethers.providers.Provider;
  protected config: NocturneConfig;
  protected handlerContract: Handler;
  protected merkleProver: SparseMerkleProver;
  protected state: NocturneClientState;
  protected syncAdapter: SDKSyncAdapter;
  protected tokenConverter: EthToTokenConverter;
  protected opTracker: OpTracker;

  readonly viewer: NocturneViewer;
  readonly gasAssets: Map<string, Asset>;

  constructor(
    viewer: NocturneViewer,
    provider: ethers.providers.Provider,
    configOrNetworkName: NocturneConfig | string,
    merkleProver: SparseMerkleProver,
    state: NocturneClientState,
    syncAdapter: SDKSyncAdapter,
    tokenConverter: EthToTokenConverter,
    nulliferChecker: OpTracker
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

    this.viewer = viewer;
    console.log(`Canonical address: `, this.viewer.canonicalAddress());
    this.handlerContract = Handler__factory.connect(
      this.config.handlerAddress,
      provider
    );
    this.merkleProver = merkleProver;
    this.state = state;
    this.syncAdapter = syncAdapter;
    this.tokenConverter = tokenConverter;
    this.opTracker = nulliferChecker;

    // set an interval to prune optimistic nfs to ensure they don't get stuck
    const prune = async () => {
      await this.pruneOptimisticNullifiers();
      setTimeout(prune, PRUNE_OPTIMISTIC_NFS_TIMER);
    };
    void prune();
  }

  // Sync SDK, returning last synced merkle index of last state diff
  async sync(opts?: SyncOpts): Promise<number | undefined> {
    const latestSyncedMerkleIndex = await syncSDK(
      { viewer: this.viewer },
      this.syncAdapter,
      this.state,
      this.merkleProver,
      opts
        ? {
            ...opts,
            finalityBlocks: opts.finalityBlocks ?? this.config.finalityBlocks,
          }
        : undefined
    );

    return latestSyncedMerkleIndex;
  }

  async prepareOperation(
    opRequest: OperationRequest,
    gasMultiplier: number
  ): Promise<PreSignOperation> {
    opRequest = await ensureOpRequestChainInfo(opRequest, this.provider);

    const deps = {
      state: this.state,
      gasAssets: this.gasAssets,
      tokenConverter: this.tokenConverter,
      handlerContract: this.handlerContract,
      merkle: this.merkleProver,
      viewer: this.viewer,
    };
    const gasAccountedOpRequest = await handleGasForOperationRequest(
      deps,
      opRequest,
      gasMultiplier
    );

    return prepareOperation(deps, gasAccountedOpRequest);
  }

  getAllAssetBalances(opts?: GetNotesOpts): AssetWithBalance[] {
    const notes = this.state.getAllNotes(opts);
    return Array.from(notes.entries()).map(([assetString, notes]) => {
      const asset = NocturneDB.parseAssetKey(assetString);
      const balance = notes.reduce((a, b) => a + b.value, 0n);
      return {
        asset,
        balance,
        numNotes: notes.length,
      };
    });
  }

  getBalanceForAsset(asset: Asset, opts?: GetNotesOpts): bigint {
    return this.state.getBalanceForAsset(asset.assetAddr, opts);
  }

  get latestSyncedMerkleIndex(): number | undefined {
    return this.state.latestSyncedMerkleIndex;
  }

  get latestCommittedMerkleIndex(): number | undefined {
    return this.state.latestCommittedMerkleIndex;
  }

  get merkleRoot(): bigint {
    return this.state.merkleRoot;
  }

  hasEnoughBalanceForOperationRequest(opRequest: OperationRequest): boolean {
    const assetRequestedAmounts = new MapWithObjectKeys<Asset, bigint>();
    for (const joinSplitRequest of opRequest.joinSplitRequests) {
      const asset = joinSplitRequest.asset;
      let currentAmount = assetRequestedAmounts.get(asset) || 0n;
      currentAmount += getJoinSplitRequestTotalValue(joinSplitRequest);
      assetRequestedAmounts.set(asset, currentAmount);
    }

    for (const [asset, requestedAmount] of assetRequestedAmounts.entries()) {
      const balance = this.state.getBalanceForAsset(asset.assetAddr);
      if (balance < requestedAmount) {
        return false;
      }
    }

    return true;
  }

  getCreationBlockOfNewestNoteInOp(
    op: PreSignOperation | SignedOperation
  ): number {
    const totalEntityIndex = getTotalEntityIndexOfNewestNoteInOp(
      this.state,
      op
    );
    return Number(
      TotalEntityIndexTrait.toComponents(totalEntityIndex).blockNumber
    );
  }

  addOpToHistory(
    op: PreSignOperation | SignedOperation,
    metadata: OperationMetadata
  ): void {
    this.state.addOpToHistory(op, metadata);
  }

  removeOpFromHistory(digest: bigint): void {
    this.state.removeOpFromHistory(digest);
  }

  get opHistory(): OpHistoryRecord[] {
    return this.state.opHistory;
  }

  get pendingOps(): OpHistoryRecord[] {
    return this.state.pendingOps;
  }

  get previousOps(): OpHistoryRecord[] {
    return this.state.previousOps;
  }

  getOpHistoryRecord(digest: bigint): OpHistoryRecord | undefined {
    return this.state.getOpHistoryRecord(digest);
  }

  setOpStatusInHistory(digest: bigint, status: OperationStatus): void {
    this.state.setStatusForOp(digest, status);
  }

  pruneOptimisticNullifiers(): void {
    this.state.pruneOptimisticNFs();
  }
}

export function getTotalEntityIndexOfNewestNoteInOp(
  state: NocturneClientState,
  op: PreSignOperation | SignedOperation
): TotalEntityIndex {
  // get the max merkle index of any note in any joinsplit in the op
  const maxMerkleIndex = maxArray(
    getMerkleIndicesAndNfsFromOp(op).map(({ merkleIndex }) => merkleIndex)
  );

  // get the corresponding TotalEntityIndex
  const totalEntityIndex = state.getTeiForMerkleIndex(Number(maxMerkleIndex));

  if (totalEntityIndex === undefined) {
    throw new Error(
      `totalEntityIndex not found for newest note with merkle index ${maxMerkleIndex}`
    );
  }

  return totalEntityIndex;
}
