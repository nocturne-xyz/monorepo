import {
    Address,
    Asset,
    AssetWithBalance,
    DepositQuoteResponse,
    ProvenOperation,
    SignedOperation,
    StealthAddress,
    SyncOpts,
} from "@nocturne-xyz/sdk";
import {
    BundlerOperationID,
    GetBalanceOpts,
    InitiateDepositResult,
    OperationHandle,
    OperationRequestWithMetadata,
    SyncWithProgressOutput
} from "./types";

export interface NocturneSdkApi {
  // *** DEPOSIT METHODS *** //

  getErc20DepositQuote(
    erc20Address: Address,
    totalValue: bigint
  ): Promise<DepositQuoteResponse>;

  /**
   * @param values Asset amounts
   * @param gasCompensationPerDeposit Gas compensation per deposit
   */
  initiateEthDeposits(
    values: bigint[],
    gasCompensationPerDeposit: bigint
  ): Promise<InitiateDepositResult>;

  /**
   * @param erc20Address Asset address
   * @param values Asset amounts
   * @param gasCompensationPerDeposit Gas compensation per deposit
   */
  initiateErc20Deposits(
    erc20Address: Address,
    values: bigint[],
    gasCompensationPerDeposit: bigint
  ): Promise<InitiateDepositResult>;

  //   getAllDeposits(): Promise<DepositHandle[]>; TODO unless there's some other way, will entail adding gql consumer to fe-sdk

  // *** OPERATION METHODS *** //

  /**
   * Format and submit a `ProvenOperation` to transfer funds out of Nocturne to a specified recipient address.
   * @param erc20Address Asset address
   * @param amount Asset amount
   * @param recipientAddress Recipient address
   */
  anonTransferErc20( // TODO this wasn't originally included, I assume we need it
    erc20Address: Address,
    amount: bigint,
    recipientAddress: Address
  ): Promise<BundlerOperationID>;

  submitOperation(operation: ProvenOperation): Promise<BundlerOperationID>; // ! TODO remove this comment, I kept signature as BundlerOperationID because I'm not sure if we want to fetch info immediately on submission

  signAndProveOperation(
    operationRequest: OperationRequestWithMetadata
  ): Promise<ProvenOperation>;

  getInFlightOperations(): Promise<OperationHandle[]>;

  // ! TODO was fetchBundlerOperationStatus() intentionally left out?
  // *** BALANCE METHODS *** //

  /**
   * Return a list of snap's assets (address & id) along with its given balance.
   * if includeUncommitted is defined and true, then the method include notes that are not yet committed to the commitment tree
   * if ignoreOptimisticNFs is defined and true, then the method will include notes that have been used by the SDK, but may not have been nullified on-chain yet
   * if both are undefined, then the method will only return notes that have been committed to the commitment tree and have not been used by the SDK yet
   */
  getAllBalances(opts?: GetBalanceOpts): Promise<AssetWithBalance[]>;

  // ! TODO
  //  Do we want to force the consumer to gain context on what id should be? (I don't even know what it's supposed to be)
  //  Asset {
  //   assetType: AssetType;
  //   assetAddr: Address;
  //   id: bigint;
  // }
  getBalanceForAsset(
    asset: Asset,
    opts?: GetBalanceOpts
  ): Promise<AssetWithBalance>; // TODO new surface area method

  // *** SYNCING METHODS *** //

  // returns an async iterator of progress updates
  syncWithProgress(syncOpts: SyncOpts): Promise<SyncWithProgressOutput>;

  // returns latest `merkleIndex` synced. Usually can be ignored
  // by default, syncs to the tip. This can take a long time, so
  // it's reccomended to call `syncWithProgress` instead and
  // give feedback to the user
  sync(syncOpts?: SyncOpts): Promise<number | undefined>;

  // *** LOW LEVEL METHODS *** //

  signOperationRequest(
    operationRequest: OperationRequestWithMetadata
  ): Promise<SignedOperation>;

  proveOperation(op: SignedOperation): Promise<ProvenOperation>;

  verifyProvenOperation(operation: ProvenOperation): Promise<boolean>;

  getLatestSyncedMerkleIndex(): Promise<number | undefined>;

  getRandomStealthAddress(): Promise<StealthAddress>;
}
