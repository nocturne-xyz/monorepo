import { Erc20Config } from "@nocturne-xyz/config";
import {
  DepositManager,
  DepositManager__factory,
  Handler,
  Handler__factory,
} from "@nocturne-xyz/contracts";
import { DepositInstantiatedEvent } from "@nocturne-xyz/contracts/dist/src/DepositManager";
import {
  ActionMetadata,
  Address,
  AssetTrait,
  AssetType,
  AssetWithBalance,
  ClosableAsyncIterator,
  DepositQuoteResponse,
  DepositRequest,
  DepositStatusResponse,
  JoinSplitProofWithPublicSignals,
  OpDigestWithMetadata,
  OperationRequestBuilder,
  OperationRequestWithMetadata,
  OperationStatusResponse,
  ProvenOperation,
  RelayRequest,
  SignedOperation,
  StealthAddress,
  StealthAddressTrait,
  SubmittableOperationWithNetworkInfo,
  SyncOpts,
  Thunk,
  VerifyingKey,
  computeOperationDigest,
  decomposeCompressedPoint,
  encodeEncodedAssetAddrWithSignBitsPI,
  hashDepositRequest,
  joinSplitPublicSignalsToArray,
  parseEventsFromContractReceipt,
  proveOperation,
  thunk,
  unpackFromSolidityProof,
} from "@nocturne-xyz/core";
import { WasmJoinSplitProver } from "@nocturne-xyz/local-prover";
import {
  OperationResult,
  Client as UrqlClient,
  fetchExchange,
} from "@urql/core";
import retry from "async-retry";
import * as JSON from "bigint-json-serialization";
import { ContractTransaction, ethers } from "ethers";
import vkey from "../circuit-artifacts/joinsplit/joinsplitVkey.json";
import { NocturneSdkApi, SnapStateApi } from "./api";
import {
  FetchDepositRequestQuery,
  FetchDepositRequestsQuery,
  DepositRequestStatus as GqlDepositRequestStatus,
} from "./gql/autogenerated/graphql";
import { DepositRequestStatusByHashQueryDocument } from "./gql/queries/DepositRequestStatusByHashQueryDocument";
import { DepositRequestsBySpenderQueryDocument } from "./gql/queries/DepositRequestsBySpenderQueryDocument";
import { SnapStateSdk } from "./metamask";
import { GetSnapOptions } from "./metamask/types";
import {
  DepositHandle,
  DepositHandleWithReceipt,
  DepositRequestStatusWithMetadata,
  DepositRequestWithMetadata,
  Endpoints,
  GetBalanceOpts,
  NocturneSdkConfig,
  OperationHandle,
  SupportedNetwork,
  SupportedProvider,
  SyncWithProgressOutput,
} from "./types";
import {
  flattenDepositRequestStatus,
  getNocturneSdkConfig,
  getTokenContract,
  toDepositRequestWithMetadata,
} from "./utils";

const WASM_PATH =
  "https://frontend-sdk-circuit-artifacts.s3.us-east-2.amazonaws.com/joinsplit/joinsplit.wasm";
const ZKEY_PATH =
  "https://frontend-sdk-circuit-artifacts.s3.us-east-2.amazonaws.com/joinsplit/joinsplit.zkey";

export interface NocturneSdkOptions {
  networkName?: SupportedNetwork;
  provider?: SupportedProvider;
  snap?: GetSnapOptions;
}

export class NocturneSdk implements NocturneSdkApi {
  protected joinSplitProverThunk: Thunk<WasmJoinSplitProver>;
  protected endpoints: Endpoints;
  protected config: NocturneSdkConfig;
  protected _provider?: SupportedProvider;
  protected _snap: SnapStateApi;
  protected urqlClient: UrqlClient;

  protected signerThunk: Thunk<ethers.Signer>;
  protected depositManagerContractThunk: Thunk<DepositManager>;
  protected handlerContractThunk: Thunk<Handler>;

  // Caller MUST conform to EIP-1193 spec (window.ethereum) https://eips.ethereum.org/EIPS/eip-1193
  constructor(options: NocturneSdkOptions = {}) {
    const networkName = options.networkName || "mainnet";
    const snapOptions = options.snap;
    const config = getNocturneSdkConfig(networkName);

    // HACK `@nocturne-xyz/local-prover` doesn't work with server components (imports a lot of unnecessary garbage)
    this.joinSplitProverThunk = thunk(async () => {
      const { WasmJoinSplitProver } = await import(
        "@nocturne-xyz/local-prover"
      );
      return new WasmJoinSplitProver(
        WASM_PATH,
        ZKEY_PATH,
        vkey as VerifyingKey
      );
    });

    this.endpoints = config.endpoints;
    this.config = config;
    this._provider = options.provider;
    this._snap = new SnapStateSdk(
      snapOptions?.version,
      snapOptions?.snapId,
      networkName
    );

    this.signerThunk = thunk(() => this.getWindowSigner());
    this.depositManagerContractThunk = thunk(async () =>
      DepositManager__factory.connect(
        this.config.config.depositManagerAddress(),
        await this.signerThunk()
      )
    );
    this.handlerContractThunk = thunk(async () =>
      Handler__factory.connect(
        this.config.config.handlerAddress(),
        await this.signerThunk()
      )
    );

    this.urqlClient = new UrqlClient({
      url: this.endpoints.subgraphEndpoint,
      exchanges: [fetchExchange],
    });
  }

  protected get provider(): SupportedProvider {
    if (typeof window === "undefined") {
      throw new Error("NocturneSdk must be used in a browser environment");
    }
    return (
      this._provider ??
      new ethers.providers.Web3Provider(window?.ethereum as any)
    );
  }

  get snap(): SnapStateApi {
    return this._snap;
  }

  protected async getWindowSigner(): Promise<ethers.Signer> {
    await this.provider.send("eth_requestAccounts", []);
    return this.provider.getSigner();
  }

  /**
   * Call `depositManager.instantiateErc20MultiDeposit` given the provided
   * `erc20Address`, `valuse`, and `gasCompPerDeposit`.
   *
   * @param values Asset amounts
   * @param gasCompensationPerDeposit Gas compensation per deposit
   */
  async initiateEthDeposits(
    values: bigint[],
    gasCompensationPerDeposit: bigint
  ): Promise<DepositHandleWithReceipt[]> {
    const signer = await this.getWindowSigner();

    const ethToWrap = values.reduce((acc, val) => acc + val, 0n);
    const gasCompRequired = gasCompensationPerDeposit * BigInt(values.length);
    const totalValue = ethToWrap + gasCompRequired;

    const signerBalance = (await signer.getBalance()).toBigInt();
    if (signerBalance < totalValue) {
      throw new Error(
        `signer does not have enough balance for gas comp + eth to wrap. balance: ${signerBalance}. gasComp required: ${gasCompRequired}. eth to wrap: ${ethToWrap}`
      );
    }

    const depositAddr = StealthAddressTrait.compress(
      await this.getRandomStealthAddress()
    );
    const tx = await (
      await this.depositManagerContractThunk()
    ).instantiateETHMultiDeposit(values, depositAddr, { value: totalValue });
    const erc20s = this.config.config.erc20s;
    const wethAddress = erc20s.get("weth")?.address;
    if (!wethAddress) {
      throw new Error("WETH address not found in Nocturne config");
    }
    return this.formDepositHandlesWithTxReceipt(tx);
  }

  async getAllDeposits(): Promise<DepositHandle[]> {
    const spender = await (await this.getWindowSigner()).getAddress();
    const { data, error }: OperationResult<FetchDepositRequestsQuery> =
      await this.urqlClient.query(DepositRequestsBySpenderQueryDocument, {
        spender,
      });

    if (error || !data) {
      throw new Error(error?.message ?? "Deposit request query failed");
    }

    return Promise.all(
      data.depositRequests
        .map(toDepositRequestWithMetadata)
        .map(async (req) => this.makeDepositHandle(req))
    );
  }

  async initiateErc20Deposits(
    erc20Address: Address,
    values: bigint[],
    gasCompensationPerDeposit: bigint
  ): Promise<DepositHandleWithReceipt[]> {
    const signer = await this.getWindowSigner();
    const gasCompRequired = gasCompensationPerDeposit * BigInt(values.length);

    const signerBalance = (await signer.getBalance()).toBigInt();
    if (signerBalance < gasCompRequired) {
      throw new Error(
        `signer does not have enough balance for gas comp. balance: ${signerBalance}. gasComp required: ${gasCompRequired}`
      );
    }

    const depositAmount = values.reduce((acc, val) => acc + val, 0n);
    const totalValue = depositAmount + gasCompRequired;

    const erc20Contract = getTokenContract(
      AssetType.ERC20,
      erc20Address,
      signer
    );
    const depositManagerContract = await this.depositManagerContractThunk();
    await erc20Contract.approve(depositManagerContract.address, totalValue);

    const depositAddr = StealthAddressTrait.compress(
      await this.getRandomStealthAddress()
    );
    const tx = await depositManagerContract.instantiateErc20MultiDeposit(
      erc20Address,
      values,
      depositAddr
    );
    return this.formDepositHandlesWithTxReceipt(tx);
  }

  /**
   * Format and submit a `ProvenOperation` to transfer funds out of Nocturne to a specified recipient address.
   * @param erc20Address Asset address
   * @param amount Asset amount
   * @param recipientAddress Recipient address
   */
  async initiateAnonErc20Transfer(
    erc20Address: Address,
    amount: bigint,
    recipientAddress: Address
  ): Promise<OperationHandle> {
    const signer = await this.getWindowSigner();
    const provider = signer.provider;

    if (!provider) {
      throw new Error("Signer is not connected");
    }

    const erc20Contract = getTokenContract(
      AssetType.ERC20,
      erc20Address,
      provider
    );

    const encodedFunction = erc20Contract.interface.encodeFunctionData(
      "transfer",
      [recipientAddress, amount]
    );

    const encodedErc20 = AssetTrait.erc20AddressToAsset(erc20Address);

    const operationRequest = new OperationRequestBuilder({
      chainId: BigInt(this.config.config.contracts.network.chainId),
      tellerContract: this.config.config.tellerAddress(),
    })
      .unwrap(encodedErc20, amount)
      .action(erc20Address, encodedFunction)
      .gas({ executionGasLimit: 500_000n })
      .build();

    const action: ActionMetadata = {
      type: "Action",
      actionType: "Transfer",
      recipientAddress,
      erc20Address,
      amount,
    };

    const submittableOperation = await this.signAndProveOperation({
      ...operationRequest,
      meta: { items: [action] },
    });
    const opHandleWithoutMetadata = this.submitOperation(submittableOperation);
    return {
      ...opHandleWithoutMetadata,
      meta: { items: [action] },
    };
  }

  async retrievePendingDeposit(
    req: DepositRequest
  ): Promise<ContractTransaction> {
    const signer = await this.getWindowSigner();
    const signerAddress = await signer.getAddress();
    if (signerAddress.toLowerCase() !== req.spender.toLowerCase()) {
      throw new Error("Spender and signer addresses do not match");
    }
    const depositManagerContract = await this.depositManagerContractThunk();
    const isOutstandingDeposit =
      await depositManagerContract._outstandingDepositHashes(
        hashDepositRequest(req)
      );
    if (!isOutstandingDeposit) {
      throw new Error("Deposit request does not exist");
    }
    return depositManagerContract.retrieveDeposit(req);
  }
  /**
   * Fetch status of existing deposit request given its hash.
   *
   * @param depositHash Deposit hash
   */
  protected async fetchScreenerDepositRequestStatus(
    depositHash: string
  ): Promise<DepositStatusResponse> {
    return (await retry(
      async () => {
        const res = await fetch(
          `${this.endpoints.screenerEndpoint}/status/${depositHash}`
        );
        return (await res.json()) as DepositStatusResponse;
      },
      {
        retries: 5,
      }
    )) as DepositStatusResponse;
  }

  async getErc20DepositQuote(
    erc20Address: Address,
    totalValue: bigint
  ): Promise<DepositQuoteResponse> {
    const signer = await this.getWindowSigner();
    const spender = await signer.getAddress();

    return await retry(
      async () => {
        const res = await fetch(`${this.endpoints.screenerEndpoint}/quote`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            spender,
            assetAddr: erc20Address,
            value: totalValue,
          }),
        });
        return (await res.json()) as DepositQuoteResponse;
      },
      {
        retries: 5,
      }
    );
  }

  /**
   * Retrieve a `SignedOperation` from the snap given an `OperationRequest`.
   * This includes all joinsplit tx inputs.
   *
   * @param operationRequest Operation request
   */
  async signOperationRequest(
    operationRequest: OperationRequestWithMetadata
  ): Promise<SignedOperation> {
    console.log("[fe-sdk] metadata:", operationRequest.meta);
    const params = {
      request: JSON.stringify(operationRequest.request),
      meta: JSON.stringify(operationRequest.meta),
    };
    console.log("[fe-sdk] params", params);
    const json = await this.invokeSnap({
      method: "nocturne_signOperation",
      params,
    });
    const op = JSON.parse(json) as SignedOperation;
    console.log("SignedOperation:", op);
    return op;
  }

  async proveOperation(
    op: SignedOperation
  ): Promise<SubmittableOperationWithNetworkInfo> {
    const prover = await this.joinSplitProverThunk();
    return await proveOperation(prover, op);
  }

  async verifyProvenOperation(operation: ProvenOperation): Promise<boolean> {
    console.log("ProvenOperation:", operation);
    const opDigest = computeOperationDigest(operation);

    const proofsWithPublicInputs: JoinSplitProofWithPublicSignals[] =
      operation.joinSplits.map((joinSplit) => {
        const pubEncodedAssetAddrWithSignBits =
          encodeEncodedAssetAddrWithSignBitsPI(
            joinSplit.publicSpend === 0n
              ? 0n
              : joinSplit.encodedAsset.encodedAssetAddr,
            operation.refundAddr
          );

        const [, refundAddrH1CompressedY] = decomposeCompressedPoint(
          operation.refundAddr.h1
        );
        const [, refundAddrH2CompressedY] = decomposeCompressedPoint(
          operation.refundAddr.h2
        );

        const pubEncodedAssetId =
          joinSplit.publicSpend === 0n
            ? 0n
            : joinSplit.encodedAsset.encodedAssetId;

        const publicSignals = joinSplitPublicSignalsToArray({
          newNoteACommitment: joinSplit.newNoteACommitment,
          newNoteBCommitment: joinSplit.newNoteBCommitment,
          commitmentTreeRoot: joinSplit.commitmentTreeRoot,
          publicSpend: joinSplit.publicSpend,
          nullifierA: joinSplit.nullifierA,
          nullifierB: joinSplit.nullifierB,
          opDigest,
          pubEncodedAssetAddrWithSignBits,
          pubEncodedAssetId,
          refundAddrH1CompressedY,
          refundAddrH2CompressedY,
          senderCommitment: joinSplit.senderCommitment,
        });

        const proof = unpackFromSolidityProof(joinSplit.proof);

        return { proof, publicSignals };
      });

    const results = await Promise.all(
      proofsWithPublicInputs.map(async (proofWithPis) => {
        const prover = await this.joinSplitProverThunk();
        await prover.verifyJoinSplitProof(proofWithPis);
      })
    );

    return results.every((result) => result);
  }

  async submitOperation(
    operation: SubmittableOperationWithNetworkInfo
  ): Promise<OperationHandle> {
    const opDigest = (await retry(
      async () => {
        const res = await fetch(`${this.endpoints.bundlerEndpoint}/relay`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ operation } as RelayRequest),
        });

        const resJSON = await res.json();
        if (!res.ok) {
          throw new Error(
            `failed to submit proven operation to bundler: ${JSON.stringify(
              resJSON
            )}`
          );
        }

        return resJSON.id;
      },
      {
        retries: 5,
      }
    )) as string;
    const digest = BigInt(opDigest);
    return {
      digest,
      getStatus: () => this.fetchBundlerOperationStatus(digest),
      metadata: undefined,
    };
  }

  async signAndProveOperation(
    operationRequest: OperationRequestWithMetadata
  ): Promise<SubmittableOperationWithNetworkInfo> {
    const op = await this.signOperationRequest(operationRequest);

    return await this.proveOperation(op);
  }

  /**
   * Return a list of snap's assets (address & id) along with its given balance.
   * if includeUncommitted is defined and true, then the method include notes that are not yet committed to the commitment tree
   * if ignoreOptimisticNFs is defined and true, then the method will include notes that have been used by the SDK, but may not have been nullified on-chain yet
   * if both are undefined, then the method will only return notes that have been committed to the commitment tree and have not been used by the SDK yet
   */
  async getAllBalances(opts?: GetBalanceOpts): Promise<AssetWithBalance[]> {
    console.log("[fe-sdk] getAllBalances with params:", opts);
    const json = await this.invokeSnap({
      method: "nocturne_getAllBalances",
      params: {
        opts,
      },
    });

    return JSON.parse(json) as AssetWithBalance[];
  }

  async getBalanceForAsset(
    erc20Address: Address,
    opts?: GetBalanceOpts
  ): Promise<AssetWithBalance> {
    const asset = AssetTrait.erc20AddressToAsset(erc20Address);
    const json = await this.invokeSnap({
      method: "nocturne_getBalanceForAsset",
      params: {
        asset,
        opts,
      },
    });
    if (json === undefined) {
      throw new Error("Balance for asset does not exist");
    }
    return JSON.parse(json) as AssetWithBalance;
  }

  async getInFlightOperations(): Promise<OperationHandle[]> {
    const json = await this.invokeSnap({
      method: "nocturne_getInFlightOperations",
    });
    const operationHandles = (JSON.parse(json) as OpDigestWithMetadata[]).map(
      ({ opDigest: digest, metadata }) => {
        return {
          digest,
          metadata,
          getStatus: () => this.fetchBundlerOperationStatus(digest),
        };
      }
    );
    return operationHandles;
  }

  /**
   * Start syncing process, returning current merkle index at tip of chain and iterator
   * returning newly synced merkle indices as syncing process occurs.
   */
  async syncWithProgress(syncOpts: SyncOpts): Promise<SyncWithProgressOutput> {
    const handlerContract = await this.handlerContractThunk();
    let latestMerkleIndexOnChain =
      (await handlerContract.totalCount()).toNumber() - 1;
    let latestSyncedMerkleIndex =
      (await this.getLatestSyncedMerkleIndex()) ?? 0;

    const NUM_REFETCHES = 5;
    const refetchEvery = Math.floor(
      (latestMerkleIndexOnChain - latestSyncedMerkleIndex) / NUM_REFETCHES
    );

    let closed = false;
    const generator = async function* (sdk: NocturneSdk) {
      let count = 0;
      while (!closed && latestSyncedMerkleIndex < latestMerkleIndexOnChain) {
        latestSyncedMerkleIndex = (await sdk.sync(syncOpts)) ?? 0;

        if (count % refetchEvery === 0) {
          latestMerkleIndexOnChain =
            (await (await sdk.handlerContractThunk()).totalCount()).toNumber() -
            1;
        }
        count++;
        yield {
          latestSyncedMerkleIndex,
        };
      }
    };

    const progressIter = new ClosableAsyncIterator(
      generator(this),
      async () => {
        closed = true;
      }
    );

    return {
      latestSyncedMerkleIndex,
      latestMerkleIndexOnChain,
      progressIter,
    };
  }

  /**
   * Invoke snap `syncNotes` method, returning latest synced merkle index.
   */
  async sync(syncOpts?: SyncOpts): Promise<number | undefined> {
    const latestSyncedMerkleIndexJson = await this.invokeSnap({
      method: "nocturne_sync",
      params: {
        syncOpts: syncOpts ? JSON.stringify(syncOpts) : undefined,
      },
    });

    const latestSyncedMerkleIndex = latestSyncedMerkleIndexJson
      ? JSON.parse(latestSyncedMerkleIndexJson)
      : undefined;

    console.log(
      "[sync] FE-SDK latestSyncedMerkleIndex",
      latestSyncedMerkleIndex
    );
    return latestSyncedMerkleIndex;
  }

  async getLatestSyncedMerkleIndex(): Promise<number | undefined> {
    const latestSyncedMerkleIndexJson = await this.invokeSnap({
      method: "nocturne_getLatestSyncedMerkleIndex",
    });

    const latestSyncedMerkleIndex = latestSyncedMerkleIndexJson
      ? JSON.parse(latestSyncedMerkleIndexJson)
      : undefined;

    console.log(
      "[getLatestSyncedMerkleIndex] FE-SDK latestSyncedMerkleIndex",
      latestSyncedMerkleIndex
    );
    return latestSyncedMerkleIndex;
  }

  /**
   * Retrieve a freshly randomized address from the snap.
   */
  async getRandomStealthAddress(): Promise<StealthAddress> {
    const json = await this.invokeSnap({
      method: "nocturne_getRandomizedAddr",
    });

    return JSON.parse(json) as StealthAddress;
  }

  // ! TODO this is an atrocious signature to hand consumers
  getAvailableErc20s(): Map<string, Erc20Config> {
    return this.config.config.erc20s;
  }

  /**
   * Given an operation digest, fetches and returns the operation status, enum'd as OperationStatus.
   */
  protected async fetchBundlerOperationStatus(
    opDigest: bigint
  ): Promise<OperationStatusResponse> {
    return await retry(
      async () => {
        const res = await fetch(
          `${this.endpoints.bundlerEndpoint}/operations/${opDigest}`
        );
        return (await res.json()) as OperationStatusResponse;
      },
      {
        retries: 5, // TODO later scope: this should probably be configurable by the caller
      }
    );
  }

  private async invokeSnap(request: {
    method: string;
    params?: object;
  }): Promise<string> {
    return (await window.ethereum.request({
      method: "wallet_invokeSnap",
      params: {
        snapId: this._snap.snapId,
        request,
      },
    })) as string;
  }

  private async formDepositHandlesWithTxReceipt(
    tx: ContractTransaction
  ): Promise<DepositHandleWithReceipt[]> {
    const receipt = await tx.wait();
    const events = parseEventsFromContractReceipt(
      receipt,
      (await this.depositManagerContractThunk()).interface.getEvent(
        "DepositInstantiated"
      )
    ) as DepositInstantiatedEvent[];
    return Promise.all(
      events.map(async (event) => {
        const {
          encodedAsset,
          value,
          nonce,
          depositAddr,
          gasCompensation,
          spender,
        } = event.args;

        const request: DepositRequestWithMetadata & {
          subgraphStatus?: GqlDepositRequestStatus;
        } = {
          spender,
          encodedAsset: {
            encodedAssetAddr: encodedAsset.encodedAssetAddr.toBigInt(),
            encodedAssetId: encodedAsset.encodedAssetId.toBigInt(),
          },
          value: value.toBigInt(),
          depositAddr: {
            h1: depositAddr.h1.toBigInt(),
            h2: depositAddr.h2.toBigInt(),
          },
          nonce: nonce.toBigInt(),
          gasCompensation: gasCompensation.toBigInt(),
          createdAtBlock: tx.blockNumber,
          subgraphStatus: GqlDepositRequestStatus.Pending,
        };
        return {
          receipt,
          // TODO restructure and flatten this logic
          handle: await this.makeDepositHandle(request),
        };
      })
    );
  }

  private async makeDepositHandle(
    requestWithStatus: DepositRequestWithMetadata & {
      subgraphStatus?: GqlDepositRequestStatus;
    }
  ): Promise<DepositHandle> {
    const { subgraphStatus, ...request } = requestWithStatus;
    const depositRequestHash = hashDepositRequest(request);
    const getStatus = async () =>
      await getDepositRequestStatus(
        this.endpoints.screenerEndpoint,
        this.urqlClient,
        depositRequestHash
      );
    const currentStatus = await getDepositRequestStatus(
      this.endpoints.screenerEndpoint,
      this.urqlClient,
      depositRequestHash,
      subgraphStatus
    );
    return {
      depositRequestHash,
      request,
      currentStatus,
      getStatus,
    };
  }
}

async function getDepositRequestStatus(
  screenerEndpoint: string,
  urqlClient: UrqlClient,
  depositRequestHash: string,
  initialSubgraphStatus?: GqlDepositRequestStatus
): Promise<DepositRequestStatusWithMetadata> {
  let subgraphStatus = initialSubgraphStatus;
  if (!subgraphStatus) {
    const { data, error }: OperationResult<FetchDepositRequestQuery> =
      await urqlClient.query(DepositRequestStatusByHashQueryDocument, {
        hash: depositRequestHash,
      });
    if (error || !data) {
      throw new Error(error?.message ?? "Deposit request query failed");
    }
    if (!data.depositRequest) {
      throw new Error(
        `Deposit request with hash ${depositRequestHash} not found`
      );
    }
    subgraphStatus = data.depositRequest.status;
  }

  const screenerResponse = await retry(
    async () => {
      const res = await fetch(
        `${screenerEndpoint}/status/${depositRequestHash}`
      );
      return (await res.json()) as DepositStatusResponse;
    },
    {
      retries: 5,
    }
  );
  const { status: screenerStatus, estimatedWaitSeconds } = screenerResponse;
  const status = flattenDepositRequestStatus(subgraphStatus, screenerStatus);
  return {
    status,
    estimatedWaitSeconds,
  };
}
