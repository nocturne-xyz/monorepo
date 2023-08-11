import {
  DepositManager,
  DepositManager__factory,
  Handler,
  Handler__factory,
} from "@nocturne-xyz/contracts";
import { WasmJoinSplitProver } from "@nocturne-xyz/local-prover";
import {
  ActionMetadata,
  Address,
  AssetTrait,
  AssetType,
  AssetWithBalance,
  ClosableAsyncIterator,
  CompressedStealthAddress,
  DepositEvent,
  DepositQuoteResponse,
  DepositRequest,
  DepositStatusResponse,
  JoinSplitProofWithPublicSignals,
  OpDigestWithMetadata,
  OperationRequestBuilder,
  OperationStatusResponse,
  ProvenOperation,
  RelayRequest,
  SignedOperation,
  StealthAddress,
  StealthAddressTrait,
  SyncOpts,
  VerifyingKey,
  computeOperationDigest,
  decomposeCompressedPoint,
  encodeEncodedAssetAddrWithSignBitsPI,
  fetchDepositEvents,
  hashDepositRequest,
  joinSplitPublicSignalsToArray,
  proveOperation,
  unpackFromSolidityProof,
} from "@nocturne-xyz/core";
import retry from "async-retry";
import * as JSON from "bigint-json-serialization";
import { ContractTransaction, ethers } from "ethers";
import { NocturneSdkApi } from "./api";
import vkey from "../circuit-artifacts/joinsplit/joinsplitVkey.json";
import {
  DepositHandle,
  GetBalanceOpts,
  InitiateDepositResult,
  NocturneSdkConfig,
  OperationHandle,
  OperationRequestWithMetadata,
  SupportedNetwork,
  SyncWithProgressOutput,
} from "./types";
import {
  FnChain,
  SNAP_ID,
  SUBGRAPH_URL,
  ValidProvider,
  getNocturneSdkConfig,
  getProvider,
  getTokenContract,
} from "./utils";

const WASM_PATH = "../circuit-artifacts/joinsplit/joinsplit.wasm";
const ZKEY_PATH = "../circuit-artifacts/joinsplit/joinsplit.zkey";

export class NocturneSdk implements NocturneSdkApi {
  protected joinSplitProver: WasmJoinSplitProver;
  protected bundlerEndpoint: string;
  protected screenerEndpoint: string;
  protected config: NocturneSdkConfig;
  protected _provider: ValidProvider | undefined;

  // Caller MUST conform to EIP-1193 spec (window.ethereum) https://eips.ethereum.org/EIPS/eip-1193
  constructor(
    networkName: SupportedNetwork = "mainnet",
    provider?: ValidProvider
  ) {
    const config = getNocturneSdkConfig(networkName);
    this.joinSplitProver = new WasmJoinSplitProver(
      WASM_PATH,
      ZKEY_PATH,
      vkey as VerifyingKey
    );
    this.bundlerEndpoint = config.endpoints.bundlerEndpoint;
    this.screenerEndpoint = config.endpoints.screenerEndpoint;
    this.config = config;
    this._provider = provider;
  }
  protected get provider(): ValidProvider {
    // we cannot directly assign provider from constructor, as window is not defined at compile-time, so would fail for callers
    if (typeof window === "undefined") {
      throw new Error(
        "NocturneSdk must be instantiated in a browser environment"
      );
    }
    return this._provider ?? getProvider();
  }

  protected depositManagerContract(
    signerOrProvider: ethers.Signer | ValidProvider
  ): DepositManager {
    return DepositManager__factory.connect(
      this.config.network.depositManagerAddress(),
      signerOrProvider
    );
  }
  protected handlerContract(
    signerOrProvider: ethers.Signer | ValidProvider
  ): Handler {
    return Handler__factory.connect(
      this.config.network.handlerAddress(),
      signerOrProvider
    );
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
  ): Promise<InitiateDepositResult> {
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
    const tx = await this.depositManagerContract(
      signer
    ).instantiateETHMultiDeposit(values, depositAddr, { value: totalValue });
    const erc20s = this.config.network.erc20s;
    const wethAddress = (
      erc20s.get("weth") ??
      erc20s.get("WETH") ??
      erc20s.get("Weth")
    )?.address; // TODO holy hack, need to refactor config for better consumption
    if (!wethAddress) {
      throw new Error("WETH address not found in Nocturne config");
    }
    return this.formInitiateDepositResult(
      await signer.getAddress(),
      tx,
      ethToWrap, // ! TODO confirm value should be ethToWrap, not totalValue
      depositAddr,
      wethAddress, // ! TODO confirm that the resulting Asset Type should be WETH
      gasCompRequired
    );
  }

  async getAllDeposits(): Promise<DepositHandle[]> {
    // TODO
    throw new Error("Not yet implemented!");
  }

  async initiateErc20Deposits(
    erc20Address: Address,
    values: bigint[],
    gasCompensationPerDeposit: bigint
  ): Promise<InitiateDepositResult> {
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
    await erc20Contract.approve(
      this.depositManagerContract(signer).address,
      totalValue
    );

    const depositAddr = StealthAddressTrait.compress(
      await this.getRandomStealthAddress()
    );
    const tx = await this.depositManagerContract(
      signer
    ).instantiateErc20MultiDeposit(erc20Address, values, depositAddr);
    return this.formInitiateDepositResult(
      await signer.getAddress(),
      tx,
      depositAmount, // ! TODO confirm value should be depositAmount, not totalValue
      depositAddr,
      erc20Address,
      gasCompRequired
    );
  }

  /**
   * Format and submit a `ProvenOperation` to transfer funds out of Nocturne to a specified recipient address.
   * @param erc20Address Asset address
   * @param amount Asset amount
   * @param recipientAddress Recipient address
   */
  async anonTransferErc20(
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

    const operationRequest = new OperationRequestBuilder()
      .unwrap(encodedErc20, amount)
      .action(erc20Address, encodedFunction)
      .maxNumRefunds(1n)
      .gas({ executionGasLimit: 500_000n })
      .build();

    const action: ActionMetadata = {
      type: "Transfer",
      recipientAddress,
      erc20Address,
      amount,
    };
    const provenOperation = await this.signAndProveOperation({
      request: operationRequest,
      metadata: { action },
    });
    const opHandleWithoutMetadata = this.submitOperation(provenOperation);
    return {
      ...opHandleWithoutMetadata,
      metadata: { action },
    };
  }

  /**
   * Initiates a deposit retrieval from the deposit manager contract.
   */
  async retrievePendingDeposit(
    req: DepositRequest
  ): Promise<ContractTransaction> {
    const signer = await this.getWindowSigner();
    const signerAddress = await signer.getAddress();
    if (signerAddress.toLowerCase() !== req.spender.toLowerCase()) {
      throw new Error("Spender and signer addresses do not match");
    }
    const isOutstandingDeposit = await this.depositManagerContract(
      signer
    )._outstandingDepositHashes(hashDepositRequest(req));
    if (!isOutstandingDeposit) {
      throw new Error("Deposit request does not exist");
    }
    return this.depositManagerContract(signer).retrieveDeposit(req);
  }
  /**
   * Fetch status of existing deposit request given its hash.
   *
   * @param depositHash Deposit hash
   */
  async fetchDepositRequestStatus(
    depositHash: string
  ): Promise<DepositStatusResponse> {
    return await retry(
      async () => {
        const res = await fetch(
          `${this.screenerEndpoint}/status/${depositHash}`
        );
        return (await res.json()) as DepositStatusResponse;
      },
      {
        retries: 5,
      }
    );
  }

  async getErc20DepositQuote(
    erc20Address: Address,
    totalValue: bigint
  ): Promise<DepositQuoteResponse> {
    const signer = await this.getWindowSigner();
    const spender = await signer.getAddress();

    return await retry(
      async () => {
        const res = await fetch(`${this.screenerEndpoint}/quote`, {
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
    console.log("[fe-sdk] metadata:", operationRequest.metadata);
    const json = await this.invokeSnap({
      method: "nocturne_signOperation",
      params: {
        operationRequest: JSON.stringify(operationRequest.request),
        opMetadata: JSON.stringify(operationRequest.metadata),
      },
    });
    const op = JSON.parse(json) as SignedOperation;
    console.log("SignedOperation:", op);
    return op;
  }

  async proveOperation(op: SignedOperation): Promise<ProvenOperation> {
    return await proveOperation(this.joinSplitProver, op);
  }

  async verifyProvenOperation(operation: ProvenOperation): Promise<boolean> {
    console.log("ProvenOperation:", operation);
    const opDigest = computeOperationDigest(operation);

    const proofsWithPublicInputs: JoinSplitProofWithPublicSignals[] =
      operation.joinSplits.map((joinSplit) => {
        const c1 = joinSplit.encSenderCanonAddrC1;
        const c2 = joinSplit.encSenderCanonAddrC2;
        const encSenderCanonAddr = { c1, c2 };
        const encodedAssetAddrWithSignBits =
          encodeEncodedAssetAddrWithSignBitsPI(
            joinSplit.encodedAsset.encodedAssetAddr,
            encSenderCanonAddr
          );

        const [, encSenderCanonAddrC1Y] = decomposeCompressedPoint(c1);
        const [, encSenderCanonAddrC2Y] = decomposeCompressedPoint(c1);

        const publicSignals = joinSplitPublicSignalsToArray({
          newNoteACommitment: joinSplit.newNoteACommitment,
          newNoteBCommitment: joinSplit.newNoteBCommitment,
          commitmentTreeRoot: joinSplit.commitmentTreeRoot,
          publicSpend: joinSplit.publicSpend,
          nullifierA: joinSplit.nullifierA,
          nullifierB: joinSplit.nullifierB,
          opDigest,
          encodedAssetAddrWithSignBits,
          encodedAssetId: joinSplit.encodedAsset.encodedAssetId,
          encSenderCanonAddrC1Y,
          encSenderCanonAddrC2Y,
        });

        const proof = unpackFromSolidityProof(joinSplit.proof);

        return { proof, publicSignals };
      });

    const results = await Promise.all(
      proofsWithPublicInputs.map(async (proofWithPis) => {
        return await this.joinSplitProver.verifyJoinSplitProof(proofWithPis);
      })
    );

    return results.every((result) => result);
  }

  async submitOperation(operation: ProvenOperation): Promise<OperationHandle> {
    const opDigest = (await retry(
      async () => {
        const res = await fetch(`${this.bundlerEndpoint}/relay`, {
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
  ): Promise<ProvenOperation> {
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
      params: opts,
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
    const provider = this.provider;
    let latestMerkleIndexOnChain =
      (await this.handlerContract(provider).totalCount()).toNumber() - 1;
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
            (await sdk.handlerContract(provider).totalCount()).toNumber() - 1;
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

  /**
   * Query subgraph for all spender's deposits
   */
  async fetchAllDeposits(): Promise<DepositEvent[]> {
    const withEntityIndices = await fetchDepositEvents(SUBGRAPH_URL, {
      spender: await (await this.getWindowSigner()).getAddress(),
    });

    return withEntityIndices.map((e) => e.inner);
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
          `${this.bundlerEndpoint}/operations/${opDigest}`
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
        snapId: SNAP_ID,
        request,
      },
    })) as string;
  }
  private formInitiateDepositResult(
    spender: string,
    tx: ContractTransaction,
    depositValue: bigint,
    depositAddr: CompressedStealthAddress,
    assetAddr: string,
    gasCompensation: bigint
  ): InitiateDepositResult {
    const depositRequest: DepositRequest = {
      spender,
      encodedAsset: new FnChain(assetAddr)
        .map(AssetTrait.erc20AddressToAsset)
        .map(AssetTrait.encode).value,
      value: depositValue,
      depositAddr,
      nonce: BigInt(tx.nonce), // ! TODO confirm the nonce should be from tx
      gasCompensation,
    };
    const depositRequestHash = hashDepositRequest(depositRequest);
    const getStatus = async () =>
      this.fetchDepositRequestStatus(depositRequestHash);

    const handle = {
      depositRequestHash,
      request: depositRequest,
      getStatus,
    };

    return {
      tx,
      handle,
    };
  }
}
