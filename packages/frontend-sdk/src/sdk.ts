import {
  BundlerOpTracker,
  MockEthToTokenConverter,
  NocturneClient,
  NocturneDB,
  OpHistoryRecord,
  OpRequestBuilder,
  OpWithMetadata,
  OperationRequestWithMetadata,
  RequestSpendKeyEoaMethod,
  RequestViewingKeyMethod,
  SignCanonAddrRegistryEntryMethod,
  SignOperationMethod,
  SyncOpts,
  isTerminalOpStatus,
  newOpRequestBuilder,
  proveOperation,
} from "@nocturne-xyz/client";
import { Erc20Config } from "@nocturne-xyz/config";
import {
  CanonicalAddressRegistry,
  CanonicalAddressRegistry__factory,
  DepositManager,
  DepositManager__factory,
  Handler,
  Handler__factory,
  Teller__factory,
} from "@nocturne-xyz/contracts";
import { DepositInstantiatedEvent } from "@nocturne-xyz/contracts/dist/src/DepositManager";
import {
  Address,
  AssetTrait,
  AssetType,
  AssetWithBalance,
  CanonAddress,
  DepositQuoteResponse,
  DepositStatusResponse,
  GAS_PER_DEPOSIT_COMPLETE,
  JoinSplitProofWithPublicSignals,
  NocturneViewer,
  OperationStatus,
  OperationStatusResponse,
  OperationTrait,
  PreSignOperation,
  ProvenOperation,
  RelayRequest,
  SDKSyncAdapter,
  SignedOperation,
  SparseMerkleProver,
  StealthAddress,
  StealthAddressTrait,
  SubmittableOperationWithNetworkInfo,
  Thunk,
  VerifyingKey,
  compressPoint,
  decomposeCompressedPoint,
  decompressPoint,
  encodeEncodedAssetAddrWithSignBitsPI,
  hashDepositRequest,
  joinSplitPublicSignalsToArray,
  packToSolidityProof,
  parseEventsFromContractReceipt,
  thunk,
  unpackFromSolidityProof,
} from "@nocturne-xyz/core";
import { IdbKvStore } from "@nocturne-xyz/idb-kv-store";
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
import { SubgraphSDKSyncAdapter } from "@nocturne-xyz/subgraph-sync-adapters";
import { E_ALREADY_LOCKED, Mutex, tryAcquire } from "async-mutex";
import retry from "async-retry";
import * as JSON from "bigint-json-serialization";
import { BigNumber, ContractTransaction, ethers } from "ethers";
import ERC20_ABI from "./abis/ERC20.json";
import { DepositAdapter, SubgraphDepositAdapter } from "./depositFetching";
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
  OperationHandle,
  PrepareOperationOpts,
  SelectedBatchPreference,
  SupportedNetwork,
  SupportedProvider,
} from "./types";
import {
  BUNDLER_RECEIVED_OP_BUFFER,
  getBalanceOptsToGetNotesOpts,
  getCircuitArtifactUrls,
  getNocturneSdkConfig,
  getOperationKind,
  getTokenContract,
  toDepositRequest,
} from "./utils";

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

  gasMultipliers?: {
    ops?: number;
    deposits?: number;
    batchPreference?: {
      SLOW: number;
      MEDIUM: number;
      FAST: number;
    };
  };
}

export class NocturneSdk {
  protected joinSplitProverThunk: Thunk<WasmJoinSplitProver>;
  protected canonAddrSigCheckProverThunk: Thunk<WasmCanonAddrSigCheckProver>;
  protected endpoints: Endpoints;
  protected sdkConfig: NocturneSdkConfig;
  protected _provider?: SupportedProvider;
  protected _snap: SnapStateSdk;
  protected depositAdapter: DepositAdapter;
  protected syncAdapter: SDKSyncAdapter;
  protected syncMutex: Mutex;
  protected opGasMultiplier: number;
  protected depositGasMultiplier: number;
  protected batchPreferenceGasMultipliers: {
    SLOW: number;
    MEDIUM: number;
    FAST: number;
  };

  protected syncProgressHandlerCounter = 0;
  protected syncProgressHandlers: Map<number, (progress: number) => void>;

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

    this.opGasMultiplier = options.gasMultipliers?.ops ?? 1;
    this.depositGasMultiplier = options.gasMultipliers?.deposits ?? 1;
    this.batchPreferenceGasMultipliers = options.gasMultipliers
      ?.batchPreference ?? {
      SLOW: 0.5,
      MEDIUM: 0.7,
      FAST: 1,
    };

    this.endpoints = sdkConfig.endpoints;
    this.sdkConfig = sdkConfig;
    this._provider = options.provider;
    this._snap = new SnapStateSdk(
      () => this.provider,
      snapOptions?.version,
      snapOptions?.snapId,
    );
    this.syncMutex = new Mutex();
    this.syncProgressHandlers = new Map();

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

    this.syncAdapter =
      options.syncAdapter ??
      new SubgraphSDKSyncAdapter(this.endpoints.subgraphEndpoint);
    this.clientThunk = thunk(async () => {
      const { vk, vkNonce } = await this.snap.invoke<RequestViewingKeyMethod>({
        method: "nocturne_requestViewingKey",
        params: null,
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
        this.syncAdapter,
        new MockEthToTokenConverter(),
        new BundlerOpTracker(this.endpoints.bundlerEndpoint),
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

  get snap(): SnapStateSdk {
    return this._snap;
  }

  get chainId(): bigint {
    return this.sdkConfig.config.chainId;
  }

  get opRequestBuilder(): OpRequestBuilder {
    return newOpRequestBuilder(this.provider, this.chainId);
  }

  async getProtocolTvl(): Promise<Map<string, bigint>> {
    const tellerAddress = this.sdkConfig.config.tellerAddress;
    const tvlByAsset = new Map<string, bigint>();
    for (const [assetName, { address }] of this.sdkConfig.config.erc20s) {
      const erc20Contract = new ethers.Contract(
        address,
        ERC20_ABI,
        this.provider,
      );
      const balance = await erc20Contract.balanceOf(tellerAddress);
      tvlByAsset.set(assetName, balance.toBigInt());
    }
    return tvlByAsset;
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
    gasCompensationPerDeposit?: bigint,
  ): Promise<DepositHandleWithReceipt[]> {
    const ethToWrap = values.reduce((acc, val) => acc + val, 0n);
    const gasCompRequired = gasCompensationPerDeposit
      ? gasCompensationPerDeposit * BigInt(values.length)
      : BigInt(values.length) * (await this.estimateGasPerDeposit());

    const totalValue = ethToWrap + gasCompRequired;

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

  async registerCanonicalAddress(): Promise<
    ethers.ContractTransaction | undefined
  > {
    const ethSigner = await getSigner(this.provider);

    const address = await this.snap.invoke<RequestSpendKeyEoaMethod>({
      method: "nocturne_requestSpendKeyEoa",
      params: null,
    });
    if (!address) {
      throw new Error("Nocturne spend key EOA not found");
    }
    const alreadyRegistered = Boolean(
      await this.getCanonAddrFromRegistry(address),
    );
    if (alreadyRegistered) return undefined;

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
          chainId: this.chainId,
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

  protected async estimateGasPerDeposit(): Promise<bigint> {
    const gasPrice = await this.provider.getGasPrice();
    return (
      (gasPrice.toBigInt() *
        GAS_PER_DEPOSIT_COMPLETE *
        BigInt(Math.floor(this.depositGasMultiplier * 100))) /
      100n
    );
  }

  async initiateErc20Deposits(
    erc20Address: Address,
    values: bigint[],
    gasCompensationPerDeposit?: bigint,
  ): Promise<DepositHandleWithReceipt[]> {
    const signer = await getSigner(this.provider);

    const gasCompRequired = gasCompensationPerDeposit
      ? gasCompensationPerDeposit * BigInt(values.length)
      : BigInt(values.length) * (await this.estimateGasPerDeposit());

    const depositAmount = values.reduce((acc, val) => acc + val, 0n);
    const totalValue = depositAmount;

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
      {
        value: gasCompRequired,
      },
    );
    return this.formDepositHandlesWithTxReceipt(tx);
  }

  async prepareOperation(
    { request, meta }: OperationRequestWithMetadata,
    { batchPreference, eoaProvidesGas }: PrepareOperationOpts,
  ): Promise<OpWithMetadata<PreSignOperation>> {
    const client = await this.clientThunk();
    const gasMultiplier = eoaProvidesGas
      ? 0
      : this.opGasMultiplier *
        this.batchPreferenceGasMultipliers[batchPreference];
    const op = await client.prepareOperation(request, gasMultiplier);
    return {
      op,
      metadata: meta,
    };
  }

  async signOperation({
    op,
    metadata,
  }: OpWithMetadata<PreSignOperation>): Promise<
    OpWithMetadata<SignedOperation>
  > {
    const _op = await this.snap.invoke<SignOperationMethod>({
      method: "nocturne_signOperation",
      params: { op, metadata },
    });

    return { op: _op, metadata };
  }

  async proveOperation({
    op,
    metadata,
  }: OpWithMetadata<SignedOperation>): Promise<
    OpWithMetadata<SubmittableOperationWithNetworkInfo>
  > {
    const prover = await this.joinSplitProverThunk();
    const _op = await proveOperation(prover, op);
    return { op: _op, metadata };
  }

  // added 12/22/23 in support of Nocturne sunset
  async withdrawFunds({
    op,
    metadata,
  }: OpWithMetadata<PreSignOperation>): Promise<ContractTransaction> {
    const signed = await this.signOperation({ op, metadata });
    const submittable = await this.proveOperation(signed);
    const teller = Teller__factory.connect(
      this.sdkConfig.config.tellerAddress,
      await this.signerThunk(),
    );
    const tx = await teller.processBundle({
      operations: [submittable.op],
    });

    return tx;
  }

  async performOperation({
    op,
    metadata,
  }: OpWithMetadata<
    PreSignOperation | SignedOperation | SubmittableOperationWithNetworkInfo
  >): Promise<OperationHandle> {
    const client = await this.clientThunk();

    const kind = getOperationKind(op);
    switch (kind) {
      case "PreSign": {
        const _op = op as PreSignOperation;

        const signed = await this.signOperation({ op: _op, metadata });
        const submittable = await this.proveOperation(signed);
        const handle = await this.submitOperation(submittable.op);
        await client.addOpToHistory(_op, metadata);
        return {
          ...handle,
          metadata,
        };
      }
      case "Signed": {
        const _op = op as SignedOperation;

        const submittable = await this.proveOperation({ op: _op, metadata });
        const handle = await this.submitOperation(submittable.op);
        await client.addOpToHistory(_op, metadata);
        return {
          ...handle,
          metadata,
        };
      }
      case "Submittable": {
        const _op = op as SubmittableOperationWithNetworkInfo;

        // can't add to history here because we don't have merkle indices
        return await this.submitOperation(_op);
      }
    }
  }

  async prepareAnonErc20Transfer(
    erc20Address: Address,
    amount: bigint,
    recipientAddress: Address,
    opts: PrepareOperationOpts,
  ): Promise<OpWithMetadata<PreSignOperation>> {
    const operationRequest = await this.opRequestBuilder
      .use(Erc20Plugin)
      .erc20Transfer(erc20Address, recipientAddress, amount)
      .build();
    return await this.prepareOperation(operationRequest, opts);
  }

  async prepareAnonEthTransfer(
    recipientAddress: Address,
    amount: bigint,
    opts: PrepareOperationOpts,
  ): Promise<OpWithMetadata<PreSignOperation>> {
    const operationRequest = await this.opRequestBuilder
      .use(EthTransferAdapterPlugin)
      .transferEth(recipientAddress, amount)
      .build();

    return await this.prepareOperation(operationRequest, opts);
  }

  async prepareAnonErc20Swap({
    tokenIn,
    tokenOut,
    amountIn,
    maxSlippageBps,
    batchPreference = "FAST",
    protocol = "UNISWAP_V3",
  }: AnonSwapRequestParams & {
    batchPreference: SelectedBatchPreference;
  }): Promise<OpWithMetadata<PreSignOperation>> {
    if (protocol !== "UNISWAP_V3") {
      throw new Error(`Protocol "${protocol}" not currently supported`);
    }

    const operationRequest = await this.opRequestBuilder
      .use(UniswapV3Plugin)
      .swap(tokenIn, amountIn, tokenOut, { maxSlippageBps })
      .build();

    return await this.prepareOperation(operationRequest, { batchPreference });
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
    maxSlippageBps = Math.floor(Math.max(maxSlippageBps, 1)); // protect against bad BigInt decimal conversion attempt
    switch (protocol) {
      case "UNISWAP_V3":
        const quote = await getSwapQuote({
          chainId: this.chainId,
          provider: this.provider,
          fromAddress: this.sdkConfig.config.handlerAddress,
          tokenInAddress: tokenIn,
          amountIn,
          tokenOutAddress: tokenOut,
          maxSlippageBps,
        });
        return quote
          ? {
              success: true,
              quote,
            }
          : {
              success: false,
              message: `No route found for swap. Token in: ${tokenIn}, Token out: ${tokenOut}. Amount in: ${amountIn}`,
            };
      default:
        throw new Error(`Unsupported protocol: ${protocol}`);
    }
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

  protected makeGetStatus(
    digest: bigint,
  ): () => Promise<OperationStatusResponse> {
    return async () => {
      // check history first. If it's in a terminal status, return that status
      const client = await this.clientThunk();
      const historyRecord = await client.getOpHistoryRecord(digest);

      // if there's no history record anymore, return `QUEUED` and, wait for the frontend
      // to re-fetch the history, and stop calling this function
      if (!historyRecord) {
        return { status: OperationStatus.QUEUED };
      }

      if (historyRecord.status && isTerminalOpStatus(historyRecord.status)) {
        return { status: historyRecord.status };
      }

      // fetch status
      const res = await this.fetchBundlerOperationStatus(digest);

      // if the bundler doesn't have it, then check how old the history record is
      // if it's older than `BUNDLER_RECEIVED_OP_BUFFER`, then assume the bundler dropped it,
      // remove it from the history, and say its queued.
      // otherwise, assume bundler is being slow and say it's queued
      if (!res) {
        if (historyRecord.createdAt + BUNDLER_RECEIVED_OP_BUFFER < Date.now()) {
          await client.removeOpFromHistory(digest);
        }
        return { status: OperationStatus.QUEUED };
      }

      // update history with new status if the status is different
      const { status } = res;
      if (status !== historyRecord.status) {
        try {
          await client.setOpStatusInHistory(digest, status);
        } catch (err) {
          if (
            err instanceof Error &&
            err.message.includes("record not found")
          ) {
            console.warn(
              `op ${digest} is not in history. skipping history update`,
            );
          } else {
            throw err;
          }
        }
      }

      // return
      return res;
    };
  }

  /**
   * Return a list of snap's assets (address & id) along with its given balance.
   * if includeUncommitted is defined and true, then the method include notes that are not yet committed to the commitment tree
   * if ignoreOptimisticNFs is defined and true, then the method will include notes that have been used by the SDK, but may not have been nullified on-chain yet
   * if both are undefined, then the method will only return notes that have been committed to the commitment tree and have not been used by the SDK yet
   */
  async getAllBalances(opts?: GetBalanceOpts): Promise<AssetWithBalance[]> {
    await this.sync();

    const client = await this.clientThunk();
    return await client.getAllAssetBalances(
      opts ? getBalanceOptsToGetNotesOpts(opts) : undefined,
    );
  }

  // todo currently core's getBalanceForAsset doesn't distinguish b/t balance not existing, and balance being 0
  async getBalanceForAsset(
    erc20Address: Address,
    opts?: GetBalanceOpts,
  ): Promise<bigint> {
    const asset = AssetTrait.erc20AddressToAsset(erc20Address);

    await this.sync();

    const client = await this.clientThunk();
    return client.getBalanceForAsset(
      asset,
      opts ? getBalanceOptsToGetNotesOpts(opts) : undefined,
    );
  }

  async getOpHistory(includePending?: boolean): Promise<OpHistoryRecord[]> {
    const client = await this.clientThunk();
    return await client.getOpHistory(includePending);
  }

  async getInFlightOperations(): Promise<OperationHandle[]> {
    const history = await this.getOpHistory(true);
    const operationHandles = history
      .filter(({ status }) => !status || !isTerminalOpStatus(status))
      .map(({ digest, metadata }) => {
        const getStatus = this.makeGetStatus(digest);
        return {
          digest,
          metadata,
          getStatus,
        };
      });
    return operationHandles;
  }

  async getCanonicalAddress(): Promise<CanonAddress | undefined> {
    // get EOA address from snap
    const eoaAddr = await this.snap.invoke<RequestSpendKeyEoaMethod>({
      method: "nocturne_requestSpendKeyEoa",
      params: null,
    });

    if (!eoaAddr) {
      // this should never happen, this.genAndSetNewSpendKey() should always be called first
      console.warn("Nocturne spend key EOA not found");
      return undefined;
    }

    // check it has corresponding canon addr in registry
    const maybeCompressedCanonAddr =
      await this.getCanonAddrFromRegistry(eoaAddr);

    if (!maybeCompressedCanonAddr) {
      return undefined;
    }

    const canonAddr = decompressPoint(maybeCompressedCanonAddr.toBigInt())!;

    // get canon addr from client
    const canonAddrFromClient = (
      await this.clientThunk()
    ).viewer.canonicalAddress();

    if (
      canonAddr.x === canonAddrFromClient.x &&
      canonAddr.y === canonAddrFromClient.y
    ) {
      return canonAddr;
    }
    return undefined;
  }

  /**
   * sync in increments, passing progress updates back to the caller through a callback
   * if another call to this function is in progress, this function will wait for the existing call to complete
   * TODO this behavior is extremely scuffed, this should be replaced by an event emitter in `client`
   */
  async sync(
    syncOpts?: Omit<SyncOpts, "timeoutSeconds">,
    handleProgress?: (progress: number) => void,
  ): Promise<void> {
    // TODO: re-architect the SDK with a proper event-based subscription model
    let handlerIndex: number | undefined;
    if (handleProgress) {
      handlerIndex = this.syncProgressHandlerCounter++;
      this.syncProgressHandlers.set(handlerIndex, handleProgress);
    }

    try {
      await tryAcquire(this.syncMutex).runExclusive(async () => {
        const finalityBlocks = this.sdkConfig.config.finalityBlocks;

        const opts = {
          ...syncOpts,
          timing: syncOpts?.timing ?? true,
          finalityBlocks: syncOpts?.finalityBlocks ?? finalityBlocks,
          timeoutSeconds: 5, // always override timeoutSeconds
        };

        const fetchEndIndex = async () => {
          if (!finalityBlocks) {
            return (await this.syncAdapter.getLatestIndexedMerkleIndex()) ?? 0;
          }

          const currentBlock = await this.provider.getBlockNumber();
          if (finalityBlocks > currentBlock) {
            return 0;
          }

          return (
            (await this.syncAdapter.getLatestIndexedMerkleIndex(
              currentBlock - finalityBlocks,
            )) ?? 0
          );
        };

        let endIndex = await fetchEndIndex();

        const startIndex = (await this.getLatestSyncedMerkleIndex()) ?? 0;
        let currentIndex = startIndex;

        // if latestCommittedMerkleIndex from the client is different from that on-chain, then the client
        // is behind  and we need to sync at least once. However, we don't currently have a way to fetch
        // the latest committed merkle index with a timelag, so for now we're going to assume the client needs
        // to sync at least once if its `latestCommittedMerkleIndex` is different from the `endIndex` we fetched
        // this should work fine, but it technically makes more queries than it needs to.
        // TODO: add method to SDKSyncAdapter to fetch latest committed merkle index with a timelag
        const latestCommittedMerkleIndex = await (
          await this.clientThunk()
        ).getLatestCommittedMerkleIndex();
        const minIterations = latestCommittedMerkleIndex !== endIndex ? 1 : 0;

        const NUM_REFETCHES = 5;
        const refetchEvery = Math.floor(
          (endIndex - startIndex) / NUM_REFETCHES,
        );

        let count = 0;
        while (count < minIterations || currentIndex < endIndex) {
          console.log("[sync] syncing", { currentIndex, endIndex, opts });
          currentIndex = (await this.syncInner(opts)) ?? 0;

          if (refetchEvery > 1 && count % refetchEvery === 0) {
            endIndex = await fetchEndIndex();
          }
          count++;

          const progress =
            ((currentIndex - startIndex) / (endIndex - startIndex)) * 100;

          this.syncProgressHandlers.forEach((handler) => handler(progress));
        }
      });
    } catch (err) {
      if (err == E_ALREADY_LOCKED) {
        await this.syncMutex.waitForUnlock();
      } else {
        throw err;
      }
    } finally {
      if (handlerIndex !== undefined) {
        this.syncProgressHandlers.delete(handlerIndex);
      }
    }
  }

  // syncs new notes and returns latest sync merkle index
  // NOTE: this method is not safe to call concurrently without wrapping in
  // a call to syncMutex.runExclusive or runExclusiveIfNotAlreadyLocked(syncMutex)
  protected async syncInner(syncOpts?: SyncOpts): Promise<number | undefined> {
    let latestSyncedMerkleIndex: number | undefined;
    try {
      const client = await this.clientThunk();
      latestSyncedMerkleIndex = await client.sync(syncOpts ?? { timing: true });
      await client.pruneOptimisticNullifiers();
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
  ): Promise<OperationStatusResponse | undefined> {
    return await retry(
      async () => {
        const res = await fetch(
          `${this.endpoints.bundlerEndpoint}/operations/${opDigest}`,
        );

        const body = await res.json();
        if (
          res.status === 404 &&
          typeof body.error === "string" &&
          body.error.includes("operation not found")
        ) {
          return undefined;
        } else if (!res.ok) {
          console.error("failed to fetch operation status", body);
          return undefined;
        }

        return (await body) as OperationStatusResponse;
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
  private async getCanonAddrFromRegistry(
    eoaAddr: string,
  ): Promise<BigNumber | undefined> {
    // check it has corresponding canon addr in registry
    const registry = await this.canonAddrRegistryThunk();
    try {
      const maybeCanonAddr =
        await registry._ethAddressToCompressedCanonAddr(eoaAddr);
      return maybeCanonAddr.isZero() ? undefined : maybeCanonAddr;
    } catch (err) {
      console.warn("error when looking up canon addr in registry: ", err);
      return undefined;
    }
  }
}
