import {
  Address,
  Asset,
  AssetWithBalance,
  OperationMetadata,
  OperationRequest,
  ProvenOperation,
  SignedOperation,
  StealthAddress,
  SyncOpts,
} from "@nocturne-xyz/sdk";
import {
  BundlerOperationID,
  DepositHandle,
  InitiateDepositResult,
  OperationHandle,
  OperationRequestWithMetadata,
  SyncWithProgressOutput,
} from "./types";

export interface NocturneSdkApi {
  // *** DEPOSIT METHODS *** //

  getErc20DepositQuote(
    erc20Address: Address,
    totalValue: bigint
  ): Promise<DepositQuote>; // ! TODO DepositQuote not in API design changes, verify its signature

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

  getAllDeposits(): Promise<DepositHandle[]>;

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

  submitOperation(operation: ProvenOperation): Promise<OperationHandle>;

  signAndProveOperation(
    operationRequest: OperationRequestWithMetadata
  ): Promise<ProvenOperation>;

  getInFlightOperations(): Promise<OperationHandle[]>;

  // *** BALANCE METHODS *** //

  getAllBalances(opts: GetBalancesOpts): Promise<AssetWithBalance[]>; // ! TODO make GetBalancesOpts, I assume the object signature is the same?

  getBalanceForAsset(asset: Asset, opts: GetBalancesOpts): Promise<bigint>; // TODO new surface area method

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

  // *** HELPERS *** //

  requestSignOperation(
    operationRequest: OperationRequestWithMetadata
  ): Promise<SignedOperation>;
}
