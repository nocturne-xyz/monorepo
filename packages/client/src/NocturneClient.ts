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
import { E_ALREADY_LOCKED, Mutex, tryAcquire } from "async-mutex";
import { NocturneEventBus, Percentage, UnsubscribeFn } from "./events";

const PRUNE_OPTIMISTIC_NFS_TIMER = 60 * 1000; // 1 minute

export class NocturneClient {
  protected provider: ethers.providers.Provider;
  protected config: NocturneConfig;
  protected handlerContract: Handler;
  protected merkleProver: SparseMerkleProver;
  protected db: NocturneDB;
  protected syncAdapter: SDKSyncAdapter;
  protected tokenConverter: EthToTokenConverter;
  protected opTracker: OpTracker;
  protected events: NocturneEventBus;
  protected syncMutex: Mutex;

  readonly viewer: NocturneViewer;
  readonly gasAssets: Map<string, Asset>;

  constructor(
    viewer: NocturneViewer,
    provider: ethers.providers.Provider,
    configOrNetworkName: NocturneConfig | string,
    merkleProver: SparseMerkleProver,
    db: NocturneDB,
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
    this.db = db;
    this.syncAdapter = syncAdapter;
    this.tokenConverter = tokenConverter;
    this.opTracker = nulliferChecker;
    this.syncMutex = new Mutex();

    this.events = new NocturneEventBus();

    // set an interval to prune optimistic nfs to ensure they don't get stuck
    const prune = async () => {
      await this.pruneOptimisticNullifiers();
      setTimeout(prune, PRUNE_OPTIMISTIC_NFS_TIMER);
    };
    void prune();
  }

  async clearDb(): Promise<void> {
    await this.db.kv.clear();
  }

  onSyncProgress(cb: (progress: Percentage) => void): UnsubscribeFn {
    return this.events.subscribe("SYNC_PROGRESS", cb);
  }

  // Sync SDK, returning last synced merkle index of last state diff
  async sync(_opts?: SyncOpts): Promise<void> {
    await tryAcquire(this.syncMutex)
      .runExclusive(async () => {
        await syncSDK(
          { viewer: this.viewer, eventBus: this.events },
          this.syncAdapter,
          this.db,
          this.merkleProver,
          {
            finalityBlocks: this.config.finalityBlocks,
          }
        );
      })
      .catch(async (err) => {
        if (err === E_ALREADY_LOCKED) {
          console.log("waiting for unlock");
          await this.syncMutex.waitForUnlock();
        } else {
          throw err;
        }
      });
  }

  async prepareOperation(
    opRequest: OperationRequest,
    gasMultiplier: number
  ): Promise<PreSignOperation> {
    opRequest = await ensureOpRequestChainInfo(opRequest, this.provider);

    const deps = {
      db: this.db,
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

    return await prepareOperation(deps, gasAccountedOpRequest);
  }

  onBalancesUpdate(
    cb: (balances: AssetWithBalance[]) => void,
    opts?: GetNotesOpts
  ): UnsubscribeFn {
    return this.events.subscribe("STATE_DIFF", async () => {
      const balances = await this.getAllAssetBalances(opts);
      cb(balances);
    });
  }

  onBalanceForAssetUpdate(
    asset: Asset,
    cb: (balance: bigint) => void,
    opts?: GetNotesOpts
  ): UnsubscribeFn {
    return this.events.subscribe("STATE_DIFF", async () => {
      const balance = await this.getBalanceForAsset(asset, opts);
      cb(balance);
    });
  }

  async getAllAssetBalances(opts?: GetNotesOpts): Promise<AssetWithBalance[]> {
    const notes = await this.db.getAllNotes(opts);
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

  async getBalanceForAsset(asset: Asset, opts?: GetNotesOpts): Promise<bigint> {
    return await this.db.getBalanceForAsset(asset, opts);
  }

  async getLatestSyncedMerkleIndex(): Promise<number | undefined> {
    return await this.db.latestSyncedMerkleIndex();
  }

  async getLatestCommittedMerkleIndex(): Promise<number | undefined> {
    return await this.db.latestCommittedMerkleIndex();
  }

  getCurrentTreeRoot(): bigint {
    return this.merkleProver.getRoot();
  }

  async hasEnoughBalanceForOperationRequest(
    opRequest: OperationRequest
  ): Promise<boolean> {
    const assetRequestedAmounts = new MapWithObjectKeys<Asset, bigint>();
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

  async addOpToHistory(
    op: PreSignOperation | SignedOperation,
    metadata: OperationMetadata
  ): Promise<void> {
    await this.db.addOpToHistory(op, metadata);
  }

  async removeOpFromHistory(digest: bigint): Promise<void> {
    await this.db.removeOpFromHistory(digest);
  }

  async getOpHistory(includePending?: boolean): Promise<OpHistoryRecord[]> {
    return await this.db.getHistory(includePending);
  }

  async getOpHistoryRecord(
    digest: bigint
  ): Promise<OpHistoryRecord | undefined> {
    return await this.db.getHistoryRecord(digest);
  }

  async setOpStatusInHistory(
    digest: bigint,
    status: OperationStatus
  ): Promise<void> {
    await this.db.setStatusForOp(digest, status);
  }

  async pruneOptimisticNullifiers(): Promise<void> {
    await this.db.pruneOptimisticNFs();
  }
}

export async function getTotalEntityIndexOfNewestNoteInOp(
  db: NocturneDB,
  op: PreSignOperation | SignedOperation
): Promise<TotalEntityIndex> {
  // get the max merkle index of any note in any joinsplit in the op
  const maxMerkleIndex = maxArray(
    getMerkleIndicesAndNfsFromOp(op).map(({ merkleIndex }) => merkleIndex)
  );

  // get the corresponding TotalEntityIndex
  const totalEntityIndex = await db.getTotalEntityIndexForMerkleIndex(
    Number(maxMerkleIndex)
  );

  if (totalEntityIndex === undefined) {
    throw new Error(
      `totalEntityIndex not found for newest note with merkle index ${maxMerkleIndex}`
    );
  }

  return totalEntityIndex;
}
