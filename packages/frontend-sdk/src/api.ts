import {
  Address,
  AssetWithBalance,
  DepositQuoteResponse,
  ProvenOperation,
  SignedOperation,
  StealthAddress,
  SyncOpts,
} from "@nocturne-xyz/core";
import { GetSnapsResponse, Snap } from "./metamask/types";
import {
  DepositHandle,
  DepositHandleWithReceipt,
  GetBalanceOpts,
  OperationHandle,
  OperationRequestWithMetadata,
  SyncWithProgressOutput,
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
  ): Promise<DepositHandleWithReceipt[]>;

  /**
   * @param erc20Address Asset address
   * @param values Asset amounts
   * @param gasCompensationPerDeposit Gas compensation per deposit
   */
  initiateErc20Deposits(
    erc20Address: Address,
    values: bigint[],
    gasCompensationPerDeposit: bigint
  ): Promise<DepositHandleWithReceipt[]>;

  getAllDeposits(): Promise<DepositHandle[]>;

  // *** OPERATION METHODS *** //

  /**
   * Format and submit a `ProvenOperation` to transfer funds out of Nocturne to a specified recipient address.
   * @param erc20Address Asset address
   * @param amount Asset amount
   * @param recipientAddress Recipient address
   */
  anonTransferErc20(
    erc20Address: Address,
    amount: bigint,
    recipientAddress: Address
  ): Promise<OperationHandle>;

  submitOperation(operation: ProvenOperation): Promise<OperationHandle>;

  signAndProveOperation(
    operationRequest: OperationRequestWithMetadata
  ): Promise<ProvenOperation>;

  getInFlightOperations(): Promise<OperationHandle[]>;

  // *** BALANCE METHODS *** //

  /**
   * Return a list of snap's assets (address & id) along with its given balance.
   * if includeUncommitted is defined and true, then the method include notes that are not yet committed to the commitment tree
   * if ignoreOptimisticNFs is defined and true, then the method will include notes that have been used by the SDK, but may not have been nullified on-chain yet
   * if both are undefined, then the method will only return notes that have been committed to the commitment tree and have not been used by the SDK yet
   */
  getAllBalances(opts?: GetBalanceOpts): Promise<AssetWithBalance[]>;

  getBalanceForAsset(
    erc20Address: Address,
    opts?: GetBalanceOpts
  ): Promise<AssetWithBalance>;

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

// *** SNAP STATE METHODS *** //
export interface SnapStateApi {
  /**
   * Detect if the wallet injecting the ethereum object is Flask.
   *
   * @returns true if the MetaMask version is Flask, false otherwise.
   */
  isFlask(): Promise<boolean>;

  /**
   * Connect Nocturne snap version to MetaMask.
   * https://docs.metamask.io/snaps/reference/rpc-api/#wallet_requestsnaps
   *
   * @returns The snaps installed in MetaMask.
   */
  connect(): Promise<GetSnapsResponse>;

  /**
   * Once Nocturne snap has been connected, get the snap from MetaMask.
   *
   * @returns The snap object returned by the extension.
   */
  get(): Promise<Snap | undefined>;

  /**
   * Clear the Snap DB, upon local dev restart or odd behavior in testnet.
   */
  clearDb(): Promise<void>;
}
