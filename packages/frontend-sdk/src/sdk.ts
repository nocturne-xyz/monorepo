import { Erc20Config } from "@nocturne-xyz/config";
import {
  CanonicalAddressRegistry,
  CanonicalAddressRegistry__factory,
  DepositManager,
  DepositManager__factory,
  Handler,
  Handler__factory,
} from "@nocturne-xyz/contracts";
import { DepositInstantiatedEvent } from "@nocturne-xyz/contracts/dist/src/DepositManager";
import {
  Address,
  AssetTrait,
  AssetType,
  AssetWithBalance,
  ClosableAsyncIterator,
  DepositQuoteResponse,
  DepositStatusResponse,
  JoinSplitProofWithPublicSignals,
  OperationStatusResponse,
  PreSignOperation,
  ProvenOperation,
  RelayRequest,
  SignedOperation,
  SparseMerkleProver,
  StealthAddress,
  StealthAddressTrait,
  SubmittableOperationWithNetworkInfo,
  Thunk,
  VerifyingKey,
  decomposeCompressedPoint,
  encodeEncodedAssetAddrWithSignBitsPI,
  hashDepositRequest,
  joinSplitPublicSignalsToArray,
  packToSolidityProof,
  parseEventsFromContractReceipt,
  thunk,
  unpackFromSolidityProof,
  NocturneViewer,
  compressPoint,
  SDKSyncAdapter,
  OperationTrait,
  OperationStatus,
} from "@nocturne-xyz/core";
import {
  NocturneClient,
  OpRequestBuilder,
  SignCanonAddrRegistryEntryMethod,
  NocturneDB,
  MockEthToTokenConverter,
  BundlerOpTracker,
  RequestViewingKeyMethod,
  proveOperation,
  SyncOpts,
  SignOperationMethod,
  newOpRequestBuilder,
  OperationRequestWithMetadata,
  ActionMetadata,
  OpHistoryStore,
  OpHistoryRecord,
} from "@nocturne-xyz/client";
import {
  WasmCanonAddrSigCheckProver,
  WasmJoinSplitProver,
} from "@nocturne-xyz/local-prover";
import {
  Erc20Plugin,
  EthTransferAdapterPlugin,
  UniswapV3Plugin,
  getSwapQuote,
} from "@nocturne-xyz/op-request-plugins";
import { Mutex } from "async-mutex";
import retry from "async-retry";
import * as JSON from "bigint-json-serialization";
import { BigNumber, ContractTransaction, ethers } from "ethers";
import { NocturneSdkApi, SnapStateApi } from "./api";
import { SnapStateSdk, getSigner } from "./metamask";
import { GetSnapOptions } from "./metamask/types";
import {
  AnonErc20SwapQuoteResponse,
  AnonSwapRequestParams,
  DepositHandle,
  DepositHandleWithReceipt,
  DisplayDepositRequest,
  DisplayDepositRequestWithMetadataAndStatus,
  Endpoints,
  GetBalanceOpts,
  NocturneSdkConfig,
  OnChainDepositRequestStatus,
  OpRequestParams,
  OperationHandle,
  SupportedNetwork,
  SupportedProvider,
  SwapTypes,
  SyncWithProgressOutput,
} from "./types";
import {
  getCircuitArtifactUrls,
  getNocturneSdkConfig,
  getTokenContract,
  runExclusiveIfNotAlreadyLocked,
  toDepositRequest,
} from "./utils";
import { DepositAdapter, SubgraphDepositAdapter } from "./depositFetching";
import { SubgraphSDKSyncAdapter } from "@nocturne-xyz/subgraph-sync-adapters";
import { IdbKvStore } from "@nocturne-xyz/idb-kv-store";

export interface NocturneSdkOptions {
  // interface for fetching deposit data from subgraph and screener
  // defaults to `SubgraphDepositAdapter` if not given
  depositAdapter?: DepositAdapter;

  // inteface for syncing merkle tree and new notes from chain
  // defaults to `SubgraphSDKSyncAdapter` if not given
  syncAdapter?: SDKSyncAdapter;

  // name of the network to use (e.g. "mainnet", "goerli", "localhost")
  networkName?: SupportedNetwork;

  // provider to use for signing and sending transactions. if not given, will use window.ethereum
  provider?: SupportedProvider;

  // version / id of the nocturne snap to use, defaults to the latest version
  // we highly recommend letting the SDK default to the latest version unless you have a good reason not to
  snap?: GetSnapOptions;
}

export class NocturneSdk implements NocturneSdkApi {
  protected joinSplitProverThunk: Thunk<WasmJoinSplitProver>;
  protected canonAddrSigCheckProverThunk: Thunk<WasmCanonAddrSigCheckProver>;
  protected endpoints: Endpoints;
  protected sdkConfig: NocturneSdkConfig;
  protected _provider?: SupportedProvider;
  protected _snap: SnapStateApi;
  protected depositAdapter: DepositAdapter;
  protected syncMutex: Mutex;

  protected signerThunk: Thunk<ethers.Signer>;
  protected depositManagerContractThunk: Thunk<DepositManager>;
  protected handlerContractThunk: Thunk<Handler>;
  protected canonAddrRegistryThunk: Thunk<CanonicalAddressRegistry>;
  protected clientThunk: Thunk<NocturneClient>;

  // Caller MUST conform to EIP-1193 spec (window.ethereum) https://eips.ethereum.org/EIPS/eip-1193
  constructor(options: NocturneSdkOptions = {}) {
    const networkName = options.networkName || "mainnet";
    const snapOptions = options.snap;
    const sdkConfig = getNocturneSdkConfig(networkName);

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

    this.endpoints = sdkConfig.endpoints;
    this.sdkConfig = sdkConfig;
    this._provider = options.provider;
    this._snap = new SnapStateSdk(
      () => this.provider,
      snapOptions?.version,
      snapOptions?.snapId,
    );
    this.syncMutex = new Mutex();

    this.signerThunk = thunk(() => getSigner(this.provider));
    this.depositManagerContractThunk = thunk(async () =>
      DepositManager__factory.connect(
        this.sdkConfig.config.depositManagerAddress,
        await this.signerThunk(),
      ),
    );
    this.handlerContractThunk = thunk(async () =>
      Handler__factory.connect(
        this.sdkConfig.config.handlerAddress,
        await this.signerThunk(),
      ),
    );
    this.canonAddrRegistryThunk = thunk(async () =>
      CanonicalAddressRegistry__factory.connect(
        this.sdkConfig.config.canonicalAddressRegistryAddress,
        await this.signerThunk(),
      ),
    );

    this.depositAdapter =
      options.depositAdapter ??
      new SubgraphDepositAdapter(
        this.endpoints.subgraphEndpoint,
        this.endpoints.screenerEndpoint,
      );

    this.clientThunk = thunk(async () => {
      const { vk, vkNonce } = await this.snap.invoke<RequestViewingKeyMethod>({
        method: "nocturne_requestViewingKey",
        params: undefined,
      });

      const viewer = new NocturneViewer(vk, vkNonce);
      const { x, y } = viewer.canonicalAddress();
      const canonAddr = JSON.stringify({ x, y });
      const canonAddrHash = ethers.utils.sha256(
        ethers.utils.toUtf8Bytes(canonAddr),
      );
      const kv = new IdbKvStore(
        `nocturne-fe-sdk-${networkName}-${canonAddrHash}`,
      );
      const db = new NocturneDB(kv);

      return new NocturneClient(
        viewer,
        this.provider,
        this.sdkConfig.config,
        await SparseMerkleProver.loadFromKV(kv),
        db,
        options.syncAdapter ??
          new SubgraphSDKSyncAdapter(this.endpoints.subgraphEndpoint),
        new MockEthToTokenConverter(),
        new BundlerOpTracker(this.endpoints.bundlerEndpoint),
        new OpHistoryStore(kv)
      );
    });
  }

  protected get wethAddress(): string {
    const address = this.sdkConfig.config.erc20s.get("WETH")?.address;
    if (!address) {
      throw new Error("WETH address not found in Nocturne config");
    }
    return address;
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

  get opRequestBuilder(): OpRequestBuilder {
    return newOpRequestBuilder(this.provider, this.sdkConfig.config.chainId);
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
    gasCompensationPerDeposit: bigint,
  ): Promise<DepositHandleWithReceipt[]> {
    const signer = await getSigner(this.provider);

    const ethToWrap = values.reduce((acc, val) => acc + val, 0n);
    const gasCompRequired = gasCompensationPerDeposit * BigInt(values.length);
    const totalValue = ethToWrap + gasCompRequired;

    const signerBalance = (await signer.getBalance()).toBigInt();
    if (signerBalance < totalValue) {
      throw new Error(
        `signer does not have enough balance for gas comp + eth to wrap. balance: ${signerBalance}. gasComp required: ${gasCompRequired}. eth to wrap: ${ethToWrap}`,
      );
    }

    const depositAddr = StealthAddressTrait.compress(
      await this.getRandomStealthAddress(),
    );
    const tx = await (
      await this.depositManagerContractThunk()
    ).instantiateETHMultiDeposit(values, depositAddr, { value: totalValue });

    return this.formDepositHandlesWithTxReceipt(tx);
  }

  async getAllDeposits(): Promise<DepositHandle[]> {
    const spender = await (await getSigner(this.provider)).getAddress();
    return await this.depositAdapter.fetchDepositRequestsBySpender(spender);
  }

  // TODO: use this method in interface
  async registerCanonicalAddress(): Promise<ethers.ContractTransaction> {
    const ethSigner = await getSigner(this.provider);
    const client = await this.clientThunk();
    const registry = await this.canonAddrRegistryThunk();
    const prover = await this.canonAddrSigCheckProverThunk();

    const canonAddr = client.viewer.canonicalAddress();
    const compressedCanonAddr = compressPoint(canonAddr);
    const nonce = (
      await registry._compressedCanonAddrToNonce(compressedCanonAddr)
    ).toBigInt();

    const { digest, sig, spendPubkey, vkNonce } =
      await this.snap.invoke<SignCanonAddrRegistryEntryMethod>({
        method: "nocturne_signCanonAddrRegistryEntry",
        params: {
          entry: {
            ethAddress: await ethSigner.getAddress(),
            compressedCanonAddr,
            perCanonAddrNonce: nonce,
          },
          chainId: BigInt(this.sdkConfig.config.chainId),
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
      packToSolidityProof(proof),
    );
  }

  async initiateErc20Deposits(
    erc20Address: Address,
    values: bigint[],
    gasCompensationPerDeposit: bigint,
  ): Promise<DepositHandleWithReceipt[]> {
    const signer = await getSigner(this.provider);
    const gasCompRequired = gasCompensationPerDeposit * BigInt(values.length);

    const signerBalance = (await signer.getBalance()).toBigInt();
    if (signerBalance < gasCompRequired) {
      throw new Error(
        `signer does not have enough balance for gas comp. balance: ${signerBalance}. gasComp required: ${gasCompRequired}`,
      );
    }

    const depositAmount = values.reduce((acc, val) => acc + val, 0n);
    const totalValue = depositAmount + gasCompRequired;

    const erc20Contract = getTokenContract(
      AssetType.ERC20,
      erc20Address,
      signer,
    );
    const depositManagerContract = await this.depositManagerContractThunk();
    await erc20Contract.approve(depositManagerContract.address, totalValue);

    const depositAddr = StealthAddressTrait.compress(
      await this.getRandomStealthAddress(),
    );
    const tx = await depositManagerContract.instantiateErc20MultiDeposit(
      erc20Address,
      values,
      depositAddr,
    );
    return this.formDepositHandlesWithTxReceipt(tx);
  }

  /**
   * Format and submit a proven operation to transfer funds out of Nocturne to a specified recipient address.
   * @param erc20Address Asset address
   * @param amount Asset amount
   * @param recipientAddress Recipient address
   */
  async initiateAnonErc20Transfer(
    erc20Address: Address,
    amount: bigint,
    recipientAddress: Address,
  ): Promise<OperationHandle> {
    return this.createOpRequest({
      type: "ANON_TRANSFER",
      erc20Address,
      recipientAddress,
      amount,
    });
  }

  async initiateAnonEthTransfer(
    recipientAddress: Address,
    amount: bigint,
  ): Promise<OperationHandle> {
    const operationRequest = await this.opRequestBuilder
      .use(EthTransferAdapterPlugin)
      .transferEth(recipientAddress, amount)
      .build();

    const actionMeta: ActionMetadata = {
      type: "Action",
      actionType: "Transfer ETH",
      recipientAddress,
      amount,
    };

    return this.performOperation(operationRequest, [actionMeta]);
  }

  async initiateAnonErc20Swap({
    protocol = "UNISWAP_V3",
    ...params
  }: AnonSwapRequestParams): Promise<OperationHandle> {
    let type: SwapTypes;
    switch (protocol) {
      case "UNISWAP_V3":
        type = "UNISWAP_V3_SWAP";
        break;
      default:
        throw new Error(`Unsupported protocol: ${protocol}`);
    }
    return this.createOpRequest({
      type,
      ...params,
    });
  }

  /**
   * Take an operation request OR submittable operation. If the former, sign and prove the operation
   * and submit it to the bundler. If the latter, directly submit it to the bundler.
   * @param opOrOpRequest Submittable operation or operation request
   * @param actionsMetadata Metadata for each action in the operation
   * @returns Operation handle
   */
  async performOperation(
    opOrOpRequest:
      | SubmittableOperationWithNetworkInfo
      | OperationRequestWithMetadata,
    actionsMetadata: ActionMetadata[],
  ): Promise<OperationHandle> {
    const metadata = { items: actionsMetadata };
    const submittableOperation =
      "request" in opOrOpRequest
        ? await this.signAndProveOperation({
            ...opOrOpRequest,
            meta: { items: actionsMetadata },
          })
        : opOrOpRequest;
      
    const client = await this.clientThunk();
    await client.history.push(submittableOperation, metadata);

    const opHandleWithoutMetadata = await this.submitOperation(submittableOperation);
    return {
      ...opHandleWithoutMetadata,
      metadata,
    };
  }

  async retrievePendingDeposit(
    displayRequest: DisplayDepositRequest,
    retrieveEthDepositsAs: "ETH" | "WETH" = "ETH",
  ): Promise<ContractTransaction> {
    const signer = await getSigner(this.provider);
    const signerAddress = await signer.getAddress();
    if (signerAddress.toLowerCase() !== displayRequest.spender.toLowerCase()) {
      throw new Error("Spender and signer addresses do not match");
    }
    const req = toDepositRequest(displayRequest);
    const depositManagerContract = await this.depositManagerContractThunk();
    const isOutstandingDeposit =
      await depositManagerContract._outstandingDepositHashes(
        hashDepositRequest(req),
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
    depositHash: string,
  ): Promise<DepositStatusResponse> {
    return (await retry(
      async () => {
        const res = await fetch(
          `${this.endpoints.screenerEndpoint}/status/${depositHash}`,
        );
        return (await res.json()) as DepositStatusResponse;
      },
      {
        retries: 5,
      },
    )) as DepositStatusResponse;
  }

  async getErc20DepositQuote(
    erc20Address: Address,
    totalValue: bigint,
  ): Promise<DepositQuoteResponse> {
    const signer = await getSigner(this.provider);
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
      },
    );
  }

  async getAnonErc20SwapQuote({
    tokenIn,
    tokenOut,
    amountIn,
    maxSlippageBps = 50,
    protocol = "UNISWAP_V3",
  }: AnonSwapRequestParams): Promise<AnonErc20SwapQuoteResponse> {
    let response: AnonErc20SwapQuoteResponse;
    switch (protocol) {
      case "UNISWAP_V3":
        const quote = await getSwapQuote({
          chainId: this.sdkConfig.config.chainId,
          provider: this.provider,
          fromAddress: this.sdkConfig.config.handlerAddress,
          tokenInAddress: tokenIn,
          amountIn,
          tokenOutAddress: tokenOut,
          maxSlippageBps,
        });
        response = quote
          ? {
              success: true,
              quote,
            }
          : {
              success: false,
              message: `No route found for swap. Token in: ${tokenIn}, Token out: ${tokenOut}. Amount in: ${amountIn}`,
            };
        break;
      default:
        throw new Error(`Unsupported protocol: ${protocol}`);
    }
    return response;
  }

  /**
   * Retrieve a `SignedOperation` from the snap given an `OperationRequest`.
   * This includes all joinsplit tx inputs.
   *
   * @param operationRequest Operation request
   */
  async signOperationRequest(
    operationRequest: OperationRequestWithMetadata,
  ): Promise<SignedOperation> {
    console.log("[fe-sdk] metadata:", operationRequest.meta);

    const client = await this.clientThunk();

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

    const op = await this.snap.invoke<SignOperationMethod>({
      method: "nocturne_signOperation",
      params: { op: preSignOp, metadata: opMeta },
    });

    await client.applyOptimisticRecordsForOp(op, opMeta);

    return op;
  }

  async proveOperation(
    op: SignedOperation,
  ): Promise<SubmittableOperationWithNetworkInfo> {
    const prover = await this.joinSplitProverThunk();
    return await proveOperation(prover, op);
  }

  async verifyProvenOperation(operation: ProvenOperation): Promise<boolean> {
    const opDigest = OperationTrait.computeDigest(operation);

    const proofsWithPublicInputs: JoinSplitProofWithPublicSignals[] =
      operation.joinSplits.map((joinSplit) => {
        const pubEncodedAssetAddrWithSignBits =
          encodeEncodedAssetAddrWithSignBitsPI(
            joinSplit.publicSpend === 0n
              ? 0n
              : joinSplit.encodedAsset.encodedAssetAddr,
            operation.refundAddr,
          );

        const [, refundAddrH1CompressedY] = decomposeCompressedPoint(
          operation.refundAddr.h1,
        );
        const [, refundAddrH2CompressedY] = decomposeCompressedPoint(
          operation.refundAddr.h2,
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
      }),
    );

    return results.every((result) => result);
  }

  async submitOperation(
    operation: SubmittableOperationWithNetworkInfo,
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
              resJSON,
            )}`,
          );
        }

        return resJSON.id;
      },
      {
        retries: 5,
      },
    )) as string;
    const digest = BigInt(opDigest);
    const getStatus = this.makeGetStatus(digest);

    return {
      digest,
      getStatus,
      metadata: undefined,
    };
  }

  protected makeGetStatus(digest: bigint): () => Promise<OperationStatusResponse> {
    let cachedStatus: OperationStatus | undefined;
    return async () => {
      // fetch 
      const res = await this.fetchBundlerOperationStatus(digest);
      
      // update history
      const { status } = res;
      if (status !== cachedStatus) {
        cachedStatus = status;

        try {
          const client = await this.clientThunk();
          await client.history.setStatus(digest, status);
        } catch (err) {
          if (err instanceof Error && err.message.includes("record not found")) {
            console.warn(`op ${digest} is not in history. skipping history update`);
          } else {
            throw err;
          }
        }
      }

      // return
      return res;
    };
  }

  async signAndProveOperation(
    operationRequest: OperationRequestWithMetadata,
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
    // if we're not already syncing, sync
    await runExclusiveIfNotAlreadyLocked(this.syncMutex)(() =>
      this.syncInner(),
    );

    const client = await this.clientThunk();
    return await client.getAllAssetBalances(opts);
  }

  // todo currently core's getBalanceForAsset doesn't distinguish b/t balance not existing, and balance being 0
  async getBalanceForAsset(
    erc20Address: Address,
    opts?: GetBalanceOpts,
  ): Promise<bigint> {
    const asset = AssetTrait.erc20AddressToAsset(erc20Address);

    // if we're not already syncing, sync
    await runExclusiveIfNotAlreadyLocked(this.syncMutex)(() =>
      this.syncInner(),
    );

    const client = await this.clientThunk();
    return client.getBalanceForAsset(asset, opts);
  }

  async getInFlightOperations(): Promise<OperationHandle[]> {
    const client = await this.clientThunk();
    const opDigestsWithMetadata =
      await client.getAllOptimisticOpDigestsWithMetadata();
    const operationHandles = opDigestsWithMetadata.map(
      ({ opDigest: digest, metadata }) => {
        const getStatus = this.makeGetStatus(digest);
        return {
          digest,
          metadata,
          getStatus,
        };
      },
    );
    return operationHandles;
  }

  /**
   * Start syncing process, returning current merkle index at tip of chain and iterator
   * returning newly synced merkle indices as syncing process occurs.
   * NOTE: this method holds a lock on syncing until the returned iterator is closed.
   *       if the caller does not wish through the entire iterator, they must explicitly close it.
   */
  async syncWithProgress(syncOpts: SyncOpts): Promise<SyncWithProgressOutput> {
    const handlerContract = await this.handlerContractThunk();
    let latestMerkleIndexOnChain =
      (await handlerContract.totalCount()).toNumber() - 1;
    let latestSyncedMerkleIndex =
      (await this.getLatestSyncedMerkleIndex()) ?? 0;

    const NUM_REFETCHES = 5;
    const refetchEvery = Math.floor(
      (latestMerkleIndexOnChain - latestSyncedMerkleIndex) / NUM_REFETCHES,
    );

    let closed = false;
    const generator = async function* (sdk: NocturneSdk) {
      const release = await sdk.syncMutex.acquire();
      let count = 0;
      while (!closed && latestSyncedMerkleIndex < latestMerkleIndexOnChain) {
        try {
          latestSyncedMerkleIndex =
            (await sdk.syncInner({ ...syncOpts, timing: true })) ?? 0;

          if (count % refetchEvery === 0) {
            latestMerkleIndexOnChain =
              (
                await (await sdk.handlerContractThunk()).totalCount()
              ).toNumber() - 1;
          }
          count++;
          yield {
            latestSyncedMerkleIndex,
          };
        } finally {
          release();
        }
      }

      release();
    };

    const progressIter = new ClosableAsyncIterator(
      generator(this),
      async () => {
        closed = true;
      },
    );

    return {
      latestSyncedMerkleIndex,
      latestMerkleIndexOnChain,
      progressIter,
    };
  }

  /**
   * sync new notes and return latest synced merkle index.
   */
  async sync(syncOpts?: SyncOpts): Promise<number | undefined> {
    return await this.syncMutex.runExclusive(() => this.syncInner(syncOpts));
  }

  async getHistory(): Promise<OpHistoryRecord[]> {
    const client = await this.clientThunk();
    return await client.history.getHistory();
  }

  // syncs new notes and returns latest sync merkle index
  // NOTE: this method is not safe to call concurrently without wrapping in
  // a call to syncMutex.runExclusive or runExclusiveIfNotAlreadyLocked(syncMutex)
  protected async syncInner(syncOpts?: SyncOpts): Promise<number | undefined> {
    let latestSyncedMerkleIndex: number | undefined;
    try {
      const client = await this.clientThunk();
      latestSyncedMerkleIndex = await client.sync({
        ...syncOpts,
        timing: true,
      });
      await client.updateOptimisticNullifiers();
    } catch (e) {
      console.log("Error syncing notes: ", e);
      throw e;
    }
    console.log(
      "[sync] FE-sdk latestSyncedMerkleIndex, ",
      latestSyncedMerkleIndex,
    );
    return latestSyncedMerkleIndex;
  }

  async getLatestSyncedMerkleIndex(): Promise<number | undefined> {
    const client = await this.clientThunk();
    const latestSyncedMerkleIndex = await client.getLatestSyncedMerkleIndex();
    console.log(
      "[getLatestSyncedMerkleIndex] FE-SDK latestSyncedMerkleIndex",
      latestSyncedMerkleIndex,
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
    return client.viewer.generateRandomStealthAddress();
  }

  // ! TODO this is an atrocious signature to hand consumers
  getAvailableErc20s(): Map<string, Erc20Config> {
    return this.sdkConfig.config.erc20s;
  }

  /**
   * Given an operation digest, fetches and returns the operation status, enum'd as OperationStatus.
   */
  protected async fetchBundlerOperationStatus(
    opDigest: bigint,
  ): Promise<OperationStatusResponse> {
    return await retry(
      async () => {
        const res = await fetch(
          `${this.endpoints.bundlerEndpoint}/operations/${opDigest}`,
        );
        return (await res.json()) as OperationStatusResponse;
      },
      {
        retries: 5, // TODO later scope: this should probably be configurable by the caller
      },
    );
  }

  private async formDepositHandlesWithTxReceipt(
    tx: ContractTransaction,
  ): Promise<DepositHandleWithReceipt[]> {
    const receipt = await tx.wait();
    const events = parseEventsFromContractReceipt(
      receipt,
      (await this.depositManagerContractThunk()).interface.getEvent(
        "DepositInstantiated",
      ),
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

        const request: DisplayDepositRequestWithMetadataAndStatus = {
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
          onChainStatus: OnChainDepositRequestStatus.Pending,
        };
        return {
          receipt,
          // TODO restructure and flatten this logic
          handle: await this.depositAdapter.makeDepositHandle(request),
        };
      }),
    );
  }

  private async createOpRequest(
    params: OpRequestParams,
  ): Promise<OperationHandle> {
    const chainId = BigInt((await this.provider.getNetwork()).chainId);
    const builder = newOpRequestBuilder(this.provider, chainId);
    let operationRequest: OperationRequestWithMetadata;
    let action: ActionMetadata;
    switch (params.type) {
      case "ANON_TRANSFER": {
        const { erc20Address, amount, recipientAddress } = params;

        operationRequest = await builder
          .use(Erc20Plugin)
          .erc20Transfer(erc20Address, recipientAddress, amount)
          .build();

        action = {
          type: "Action",
          actionType: "Transfer",
          recipientAddress,
          erc20Address,
          amount,
        };
        break;
      }
      case "UNISWAP_V3_SWAP": {
        const { tokenIn, amountIn, tokenOut, maxSlippageBps } = params;
        operationRequest = await builder
          .use(UniswapV3Plugin)
          .swap(tokenIn, amountIn, tokenOut, { maxSlippageBps })
          .build();
        action = {
          type: "Action",
          actionType: "UniswapV3 Swap",
          tokenIn,
          inAmount: amountIn,
          tokenOut,
        };
        break;
      }
    }
    return this.performOperation(operationRequest, [action]);
  }
}
