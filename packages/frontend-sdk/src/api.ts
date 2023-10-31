import { Erc20Config } from "@nocturne-xyz/config";
import {
  Address,
  AssetWithBalance,
  DepositQuoteResponse,
  ProvenOperation,
  SignedOperation,
  StealthAddress,
  SubmittableOperationWithNetworkInfo,
} from "@nocturne-xyz/core";
import {
  OpHistoryRecord,
  OperationRequestWithMetadata,
  RpcRequestMethod,
  SyncOpts,
  GetNotesOpts,
} from "@nocturne-xyz/client";
import { ContractTransaction } from "ethers";
import { GetSnapsResponse, Snap } from "./metamask/types";
import {
  AnonErc20SwapQuoteResponse,
  AnonSwapRequestParams,
  DepositHandle,
  DepositHandleWithReceipt,
  DisplayDepositRequest,
  OperationHandle,
} from "./types";

export interface NocturneSdkApi {
  // *** DEPOSIT METHODS *** //

  /**
   *  Provides an ETA on how long the deposits will take to enter the protocol.
   * Used for both ETH/WETH and ERC20 deposits.
   */

  getErc20DepositQuote(
    erc20Address: Address,
    totalValue: bigint
  ): Promise<DepositQuoteResponse>;

  /**
   * Register the user's canonical address from the snap instance against the current signer EOA.
   */
  registerCanonicalAddress(): Promise<ContractTransaction>;

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

  /**
   * Initiates a deposit retrieval from the deposit manager contract.
   */
  retrievePendingDeposit(
    displayRequest: DisplayDepositRequest
  ): Promise<ContractTransaction>;

  // *** OPERATION METHODS *** //

  /**
   * Format and submit a proven operation to transfer WETH out of Nocturne to a specified
   * recipient address as ETH.
   * @param recipientAddress Recipient address
   * @param amount ETH amount to transfer
   * @returns Operation handle
   */
  initiateAnonEthTransfer(
    recipientAddress: Address,
    amount: bigint
  ): Promise<OperationHandle>;

  /**
   * Format and submit a `ProvenOperation` to transfer funds out of Nocturne to a specified recipient address.
   * @param erc20Address Asset address
   * @param amount Asset amount
   * @param recipientAddress Recipient address
   */
  initiateAnonErc20Transfer(
    erc20Address: Address,
    amount: bigint,
    recipientAddress: Address
  ): Promise<OperationHandle>;

  initiateAnonErc20Swap(
    params: AnonSwapRequestParams
  ): Promise<OperationHandle>;

  submitOperation(
    operation: SubmittableOperationWithNetworkInfo
  ): Promise<OperationHandle>;

  signAndProveOperation(
    operationRequest: OperationRequestWithMetadata
  ): Promise<SubmittableOperationWithNetworkInfo>;

  getInFlightOperations(): Promise<OperationHandle[]>;

  // *** BALANCE METHODS *** //

  /**
   * Return a list of snap's assets (address & id) along with its given balance.
   * if includeUncommitted is defined and true, then the method include notes that are not yet committed to the commitment tree
   * if ignoreOptimisticNFs is defined and true, then the method will include notes that have been used by the SDK, but may not have been nullified on-chain yet
   * if both are undefined, then the method will only return notes that have been committed to the commitment tree and have not been used by the SDK yet
   */
  getAllBalances(opts?: GetNotesOpts): Promise<AssetWithBalance[]>;

  getBalanceForAsset(
    erc20Address: Address,
    opts?: GetNotesOpts 
  ): Promise<bigint>;

  // *** SYNCING METHODS *** //
  
  // syncs the SDK, taking a callback to report progress
  // `syncOpts.timoutSeconds` is used as the interval between progress reports. if not given, there will be one progress report at the end.
  // if another call to `sync` is already in progress, this call will simply wait for that one to finish
  // TODO this behavior is scuffed, we should re-think it
  sync(syncOpts?: SyncOpts, handleProgress?: (progress: number) => void): Promise<void>;

  // *** LOW LEVEL METHODS *** //

  signOperationRequest(
    operationRequest: OperationRequestWithMetadata
  ): Promise<SignedOperation>;

  proveOperation(
    op: SignedOperation
  ): Promise<SubmittableOperationWithNetworkInfo>;

  verifyProvenOperation(operation: ProvenOperation): Promise<boolean>;

  getLatestSyncedMerkleIndex(): Promise<number | undefined>;

  getRandomStealthAddress(): Promise<StealthAddress>;

  /**
   * Clears the sync DB, upon local dev restart or odd behavior in testnet.
   */
  clearSyncState(): Promise<void>;

  getAnonErc20SwapQuote(
    params: AnonSwapRequestParams
  ): Promise<AnonErc20SwapQuoteResponse>;

  // *** ACCESSOR METHODS *** //

  snap: SnapStateApi;

  getAvailableErc20s(): Map<string, Erc20Config>;

  // *** HISTORY METHODS *** //

  getHistory(): Promise<OpHistoryRecord[]>;
}

// *** SNAP STATE METHODS *** //
export interface SnapStateApi {
  /**
   * id of the snap (i.e, "npm:@nocturne-xyz/snap", or "local:http://localhost:<port>")
   */
  snapId: string;

  /**
   * version of the snap being connected to if specified
   */
  version?: string;

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

  invoke<RpcMethod extends RpcRequestMethod>(
    request: Omit<RpcMethod, "return">
  ): Promise<RpcMethod["return"]>;
}
