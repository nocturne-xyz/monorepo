import { Erc20Config } from "@nocturne-xyz/config";
import {
  CanonicalAddressRegistry,
  CanonicalAddressRegistry__factory,
  DepositManager,
  DepositManager__factory,
  Handler,
  Handler__factory,
} from "@nocturne-xyz/contracts";
import { IdbKvStore } from "@nocturne-xyz/idb-kv-store";
import { Mutex } from "async-mutex";
import { DepositInstantiatedEvent } from "@nocturne-xyz/contracts/dist/src/DepositManager";
import {
  ActionMetadata,
  Address,
  AssetTrait,
  AssetType,
  AssetWithBalance,
  ClosableAsyncIterator,
  DepositQuoteResponse,
  DepositStatusResponse,
  JoinSplitProofWithPublicSignals,
  newOpRequestBuilder,
  OperationRequestWithMetadata,
  OperationStatusResponse,
  ProvenOperation,
  RelayRequest,
  RpcRequestMethod,
  SignOperationMethod,
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
  stringifyObjectValues,
  thunk,
  unpackFromSolidityProof,
  NocturneClient,
  RequestViewingKeyMethod,
  NocturneViewer,
  SparseMerkleProver,
  NocturneDB,
  SubgraphSDKSyncAdapter,
  MockEthToTokenConverter,
  BundlerOpTracker,
  PreSignOperation,
  compressPoint,
  SignCanonAddrRegistryEntryMethod,
  packToSolidityProof,
} from "@nocturne-xyz/core";
import {
  WasmCanonAddrSigCheckProver,
  WasmJoinSplitProver,
} from "@nocturne-xyz/local-prover";
import {
  OperationResult,
  Client as UrqlClient,
  fetchExchange,
} from "@urql/core";
import retry from "async-retry";
import * as JSON from "bigint-json-serialization";
import { BigNumber, ContractTransaction, ethers } from "ethers";
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
  DisplayDepositRequest,
  DisplayDepositRequestWithMetadata,
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
  getCircuitArtifactUrls,
  getNocturneSdkConfig,
  getTokenContract,
  toDepositRequest,
  toDepositRequestWithMetadata,
} from "./utils";
import { Erc20Plugin } from "@nocturne-xyz/op-request-plugins";

export interface NocturneSdkOptions {
  networkName?: SupportedNetwork;
  provider?: SupportedProvider;
  snap?: GetSnapOptions;
}

export class NocturneSdk implements NocturneSdkApi {
  protected joinSplitProverThunk: Thunk<WasmJoinSplitProver>;
  protected canonAddrSigCheckProverThunk: Thunk<WasmCanonAddrSigCheckProver>;
  protected endpoints: Endpoints;
  protected config: NocturneSdkConfig;
  protected _provider?: SupportedProvider;
  protected _snap: SnapStateApi;
  protected urqlClient: UrqlClient;
  protected syncMutex: Mutex;

  protected db: NocturneDB;

  protected signerThunk: Thunk<ethers.Signer>;
  protected chainIdThunk: Thunk<bigint>;
  protected depositManagerContractThunk: Thunk<DepositManager>;
  protected handlerContractThunk: Thunk<Handler>;
  protected canonAddrRegistryThunk: Thunk<CanonicalAddressRegistry>;
  protected clientThunk: Thunk<NocturneClient>;

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

      const urls = getCircuitArtifactUrls(networkName);
      const vkey = (await (
        await fetch(urls.joinSplit.vkey)
      ).json()) as VerifyingKey;
      const { wasm, zkey } = urls.joinSplit;
      return new WasmJoinSplitProver(wasm, zkey, vkey);
    });

    this.canonAddrSigCheckProverThunk = thunk(async () => {
      const { WasmCanonAddrSigCheckProver } = await import(
        "@nocturne-xyz/local-prover"
      );

      const urls = getCircuitArtifactUrls(networkName);
      const vkey = (await (
        await fetch(urls.canonAddrSigCheck.vkey)
      ).json()) as VerifyingKey;
      const { wasm, zkey } = urls.canonAddrSigCheck;
      return new WasmCanonAddrSigCheckProver(wasm, zkey, vkey);
    });

    this.endpoints = config.endpoints;
    this.config = config;
    this._provider = options.provider;
    this._snap = new SnapStateSdk(
      snapOptions?.version,
      snapOptions?.snapId,
      networkName
    );
    this.syncMutex = new Mutex();

    this.signerThunk = thunk(() => this.getWindowSigner());
    this.chainIdThunk = thunk(() =>
      this.provider.getNetwork().then((n) => BigInt(n.chainId))
    );
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
    this.canonAddrRegistryThunk = thunk(async () =>
      CanonicalAddressRegistry__factory.connect(
        this.config.config.canonicalAddressRegistryAddress(),
        await this.signerThunk()
      )
    );

    this.urqlClient = new UrqlClient({
      url: this.endpoints.subgraphEndpoint,
      exchanges: [fetchExchange],
    });
    const kv = new IdbKvStore(`nocturne-fe-sdk-${networkName}`);
    this.db = new NocturneDB(kv);

    this.clientThunk = thunk(async () => {
      const { vk, vkNonce } = await this.invokeSnap<RequestViewingKeyMethod>({
        method: "nocturne_requestViewingKey",
        params: undefined,
      });

      return new NocturneClient(
        new NocturneViewer(vk, vkNonce),
        this.provider,
        this.config.config,
        await SparseMerkleProver.loadFromKV(kv),
        this.db,
        new SubgraphSDKSyncAdapter(this.endpoints.subgraphEndpoint),
        new MockEthToTokenConverter(),
        new BundlerOpTracker(this.endpoints.bundlerEndpoint)
      );
    });
  }

  protected get wethAddress(): string | undefined {
    return this.config.config.erc20s.get("weth")?.address;
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
    if (!this.wethAddress) {
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

  // TODO: use this method in interface
  async registerCanonicalAddress(): Promise<ethers.ContractTransaction> {
    const ethSigner = await this.getWindowSigner();
    const client = await this.clientThunk();
    const registry = await this.canonAddrRegistryThunk();
    const prover = await this.canonAddrSigCheckProverThunk();

    const canonAddr = client.viewer.canonicalAddress();
    const compressedCanonAddr = compressPoint(canonAddr);
    const nonce = (
      await registry._compressedCanonAddrToNonce(compressedCanonAddr)
    ).toBigInt();

    const { digest, sig, spendPubkey, vkNonce } =
      await this.invokeSnap<SignCanonAddrRegistryEntryMethod>({
        method: "nocturne_signCanonAddrRegistryEntry",
        params: {
          entry: {
            ethAddress: await ethSigner.getAddress(),
            compressedCanonAddr,
            perCanonAddrNonce: nonce,
          },
          chainId: BigInt(this.config.config.contracts.network.chainId),
          registryAddress: registry.address,
        },
      });

    const { proof } = await prover.proveCanonAddrSigCheck({
      canonAddr,
      msg: digest,
      sig,
      spendPubkey,
      vkNonce,
    });

    return registry.setCanonAddr(
      compressedCanonAddr,
      packToSolidityProof(proof)
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
    const chainId = BigInt((await this.provider.getNetwork()).chainId);
    const operationRequest = await newOpRequestBuilder(this.provider, chainId)
      .use(Erc20Plugin)
      .erc20Transfer(erc20Address, recipientAddress, amount)
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
    displayRequest: DisplayDepositRequest,
    retrieveEthDepositsAs: "ETH" | "WETH" = "ETH"
  ): Promise<ContractTransaction> {
    const signer = await this.getWindowSigner();
    const signerAddress = await signer.getAddress();
    if (signerAddress.toLowerCase() !== displayRequest.spender.toLowerCase()) {
      throw new Error("Spender and signer addresses do not match");
    }
    const req = toDepositRequest(displayRequest);
    const depositManagerContract = await this.depositManagerContractThunk();
    const isOutstandingDeposit =
      await depositManagerContract._outstandingDepositHashes(
        hashDepositRequest(req)
      );
    if (!isOutstandingDeposit) {
      throw new Error("Deposit request does not exist");
    }
    if (
      retrieveEthDepositsAs === "ETH" &&
      displayRequest.asset.assetAddr === this.wethAddress
    ) {
      return depositManagerContract.retrieveETHDeposit(req);
    } else {
      return depositManagerContract.retrieveDeposit(req);
    }
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
    const client = await this.clientThunk();

    // NOTE: we should never end up in situation where this is called before normal nocturne_sync, otherwise there will be long delay
    const warnTimeout = setTimeout(() => {
      console.warn(
        "[fe-sdk] the SDK has not yet been synced. This may cause a long delay until `signOperation` returns. It's strongly reccomended to explicitly use `sync` or `syncWithProgress` to ensure the SDK is fully synced before calling `signOperation`"
      );
    }, 5000);
    await this.syncMutex.runExclusive(async () => await client.sync());
    clearTimeout(warnTimeout);

    await client.updateOptimisticNullifiers();

    const { meta: opMeta, request: opRequest } = operationRequest;

    // Ensure user has minimum balance for request
    if (!(await client.hasEnoughBalanceForOperationRequest(opRequest))) {
      throw new Error("Insufficient balance for operation request");
    }

    let preSignOp: PreSignOperation | undefined;
    try {
      preSignOp = await client.prepareOperation(opRequest);
    } catch (e) {
      console.log("[fe-sdk] prepareOperation failed: ", e);
      throw e;
    }

    const op = await this.invokeSnap<SignOperationMethod>({
      method: "nocturne_signOperation",
      params: { op: preSignOp, metadata: opMeta },
    });

    console.log("SignedOperation:", op);

    await client.applyOptimisticRecordsForOp(op, opMeta);

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
          joinSplitInfoCommitment: joinSplit.joinSplitInfoCommitment,
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
    const client = await this.clientThunk();

    await this.syncMutex.runExclusive(async () => await client.sync());
    return await client.getAllAssetBalances(opts);
  }

  // todo currently core's getBalanceForAsset doesn't distinguish b/t balance not existing, and balance being 0
  async getBalanceForAsset(
    erc20Address: Address,
    opts?: GetBalanceOpts
  ): Promise<bigint> {
    const asset = AssetTrait.erc20AddressToAsset(erc20Address);
    const client = await this.clientThunk();

    await this.syncMutex.runExclusive(async () => await client.sync());
    return client.getBalanceForAsset(asset, opts);
  }

  async getInFlightOperations(): Promise<OperationHandle[]> {
    const client = await this.clientThunk();
    const opDigestsWithMetadata =
      await client.getAllOptimisticOpDigestsWithMetadata();
    const operationHandles = opDigestsWithMetadata.map(
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
    const generator = async function* (
      sdk: NocturneSdk,
      client: NocturneClient
    ) {
      let count = 0;
      while (!closed && latestSyncedMerkleIndex < latestMerkleIndexOnChain) {
        latestSyncedMerkleIndex = (await client.sync(syncOpts)) ?? 0;

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
      generator(this, await this.clientThunk()),
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
    let latestSyncedMerkleIndex: number | undefined;
    try {
      const client = await this.clientThunk();
      latestSyncedMerkleIndex = await this.syncMutex.runExclusive(
        async () => await client.sync(syncOpts)
      );
      await client.updateOptimisticNullifiers();
    } catch (e) {
      console.log("Error syncing notes: ", e);
      throw e;
    }
    console.log(
      "[sync] FE-sdk latestSyncedMerkleIndex, ",
      latestSyncedMerkleIndex
    );
    return latestSyncedMerkleIndex;
  }

  async getLatestSyncedMerkleIndex(): Promise<number | undefined> {
    const client = await this.clientThunk();
    const latestSyncedMerkleIndex = await client.getLatestSyncedMerkleIndex();
    console.log(
      "[getLatestSyncedMerkleIndex] FE-SDK latestSyncedMerkleIndex",
      latestSyncedMerkleIndex
    );
    return latestSyncedMerkleIndex;
  }

  async clearSyncState(): Promise<void> {
    const client = await this.clientThunk();
    await client.clearDb();
  }

  /**
   * Retrieve a freshly randomized address from the snap.
   */
  async getRandomStealthAddress(): Promise<StealthAddress> {
    const client = await this.clientThunk();
    return await client.viewer.generateRandomStealthAddress();
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

  private async invokeSnap<RpcMethod extends RpcRequestMethod>(
    request: Omit<RpcMethod, "return">
  ): Promise<RpcMethod["return"]> {
    console.log("[fe-sdk] invoking snap with request:", request);
    const stringifiedParams = request.params
      ? stringifyObjectValues(request.params)
      : undefined;
    const jsonRpcRequest = {
      method: "wallet_invokeSnap",
      params: {
        snapId: this._snap.snapId,
        request: {
          method: request.method,
          params: stringifiedParams,
        },
      },
    };
    console.log("[fe-sdk] jsonRpcRequest", jsonRpcRequest);
    const response = await window.ethereum.request<RpcMethod["return"]>(
      jsonRpcRequest
    );
    return response ? JSON.parse(response as unknown as string) : undefined;
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
          encodedAsset: _encodedAsset,
          value,
          nonce,
          depositAddr,
          gasCompensation,
          spender,
        } = event.args;

        const encodedAsset = {
          encodedAssetAddr: _encodedAsset.encodedAssetAddr.toBigInt(),
          encodedAssetId: _encodedAsset.encodedAssetId.toBigInt(),
        };
        const asset = AssetTrait.decode(encodedAsset);

        const request: DisplayDepositRequestWithMetadata & {
          subgraphStatus?: GqlDepositRequestStatus;
        } = {
          spender,
          asset: {
            assetAddr: asset.assetAddr,
            assetType: asset.assetType,
            id: BigNumber.from(asset.id),
          },
          value,
          depositAddr,
          nonce,
          gasCompensation,
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
    requestWithStatus: DisplayDepositRequestWithMetadata & {
      subgraphStatus?: GqlDepositRequestStatus;
    }
  ): Promise<DepositHandle> {
    const { subgraphStatus, ...request } = requestWithStatus;
    const depositRequestHash = hashDepositRequest(toDepositRequest(request));
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
