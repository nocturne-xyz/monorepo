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
  OperationMetadata,
  OperationRequest,
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
} from "@nocturne-xyz/sdk";
import retry from "async-retry";
import * as JSON from "bigint-json-serialization";
import { ContractTransaction, ethers } from "ethers";
import { NocturneSdkApi } from "./api";
import {
  BundlerOperationID,
  InitiateDepositResult,
  NocturneSdkConfig,
  OperationRequestWithMetadata,
  SupportedNetwork,
  SyncWithProgressOutput,
} from "./types";
import {
  SNAP_ID,
  SUBGRAPH_URL,
  getNocturneSdkConfig,
  getTokenContract,
  getWindowSigner,
} from "./utils";

const WASM_PATH = "/joinsplit/joinsplit.wasm"; // ! TODO this pathing style might be outdated, no longer work
const ZKEY_PATH = "/joinsplit/joinsplit.zkey";
const VKEY_PATH = "/joinsplit/joinsplitVkey.json";

export class NocturneFrontendSDK implements NocturneSdkApi {
  // TODO verify all methods are implemented, rn error doesnt display for class if a method isn't impl'd. They may show only once the current method errs are resolved
  protected joinSplitProver: WasmJoinSplitProver;
  protected depositManagerContract: DepositManager;
  protected handlerContract: Handler;
  protected bundlerEndpoint: string;
  protected screenerEndpoint: string;

  constructor(
    provider: ethers.providers.Provider,
    networkName: SupportedNetwork = "mainnet", // ! todo confirm using network name for default config is what's intended
    config?: NocturneSdkConfig
  ) {
    const _config = config || getNocturneSdkConfig(networkName);

    const depositManagerAddress = _config.config.depositManagerAddress();
    const depositManagerContract = DepositManager__factory.connect(
      depositManagerAddress,
      provider // ! TODO is it fine that it's provider not signer? double check
    );

    const handlerAddress = _config.config.handlerAddress();
    const handlerContract = Handler__factory.connect(handlerAddress, provider); // ! TODO is it fine that it's provider not signer? double check

    const vkey: VerifyingKey = JSON.parse(await(await fetch(VKEY_PATH)).text()); // ! TODO async requirement
    this.joinSplitProver = new WasmJoinSplitProver(WASM_PATH, ZKEY_PATH, vkey);
    this.depositManagerContract = depositManagerContract;
    this.handlerContract = handlerContract;
    this.bundlerEndpoint = _config.endpoints.bundlerEndpoint;
    this.screenerEndpoint = _config.endpoints.screenerEndpoint;
  }

  /**
   * Call `depositManager.instantiateErc20MultiDeposit` given the provided
   * `erc20Address`, `valuse`, and `gasCompPerDeposit`.
   *
   * @param values Asset amounts
   * @param gasCompensationPerDeposit Gas compensation per deposit
   */
  async initiateEthDeposits(
    // TODO make API response conform to new change
    values: bigint[],
    gasCompensationPerDeposit: bigint
  ): Promise<InitiateDepositResult> {
    const signer = await getWindowSigner();

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
    const tx = await this.depositManagerContract.instantiateETHMultiDeposit(
      values,
      depositAddr,
      { value: totalValue }
    );

    return this.formInitiateDepositResult(
      await signer.getAddress(),
      tx,
      ethToWrap, // ! TODO confirm value should be ethToWrap, not totalValue
      depositAddr,
      "0x00", // ! TODO need proper asset addr, also confirm that the resulting Asset Type should be WETH
      gasCompRequired
    );
  }

  async initiateErc20Deposits(
    erc20Address: Address,
    values: bigint[],
    gasCompensationPerDeposit: bigint
  ): Promise<InitiateDepositResult> {
    const signer = await getWindowSigner();
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
      this.depositManagerContract.address,
      totalValue
    );

    const depositAddr = StealthAddressTrait.compress(
      await this.getRandomStealthAddress()
    );
    const tx = await this.depositManagerContract.instantiateErc20MultiDeposit(
      erc20Address,
      values,
      depositAddr
    );
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
  ): Promise<BundlerOperationID> {
    const signer = await getWindowSigner();
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

    const provenOperation = await this.signAndProveOperation(operationRequest, {
      action,
    });
    return this.submitProvenOperation(provenOperation);
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

  /**
   * Fetch quote of wait time in seconds given spender, assetAddr, and value.
   *
   * @param erc20Address Asset address
   * @param totalValue Asset amount
   */
  async fetchDepositQuote(
    erc20Address: Address,
    totalValue: bigint
  ): Promise<DepositQuoteResponse> {
    const signer = await getWindowSigner();
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
   * Generate `ProvenOperation` given an `operationRequest`.
   *
   * @param operationRequest Operation request
   */
  async signAndProveOperation(
    // TODO add OperationRequestWithMetadata, make param signature conform accordingly
    operationRequest: OperationRequest,
    opMetadata: OperationMetadata
  ): Promise<ProvenOperation> {
    const op = await this.requestSignOperation(operationRequest, opMetadata);

    console.log("SignedOperation:", op);
    return await this.proveOperation(op);
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

  // Submit a proven operation to the bundler server
  // returns the bundler's ID for the submitted operation, which can be used to check the status of the operation
  async submitProvenOperation(
    operation: ProvenOperation
  ): Promise<BundlerOperationID> {
    return await retry(
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
    );
  }

  /**
   * Return a list of snap's assets (address & id) along with its given balance.
   * if includeUncommitted is defined and true, then the method include notes that are not yet committed to the commitment tree
   * if ignoreOptimisticNFs is defined and true, then the method will include notes that have been used by the SDK, but may not have been nullified on-chain yet
   * if both are undefined, then the method will only return notes that have been committed to the commitment tree and have not been used by the SDK yet
   */
  async getAllBalances({
    includeUncommitted = false,
    ignoreOptimisticNFs = false,
  } = {}): Promise<AssetWithBalance[]> {
    const params = {
      includeUncommitted,
      ignoreOptimisticNFs,
    };
    console.log("[fe-sdk] getAllBalances with params:", params);
    const json = (await window.ethereum.request({
      method: "wallet_invokeSnap",
      params: {
        snapId: SNAP_ID,
        request: {
          method: "nocturne_getAllBalances",
          params,
        },
      },
    })) as string;

    return JSON.parse(json) as AssetWithBalance[];
  }

  /**
   * Return list of all inflight operation digests and metadata about each operation.
   */
  async getInflightOpDigestsWithMetadata(): Promise<OpDigestWithMetadata[]> {
    const json = (await window.ethereum.request({
      method: "wallet_invokeSnap",
      params: {
        snapId: SNAP_ID,
        request: {
          method: "nocturne_getInflightOpDigestsWithMetadata",
        },
      },
    })) as string;

    return JSON.parse(json) as OpDigestWithMetadata[];
  }

  /**
   * Given an operation digest, fetches and returns the operation status, enum'd as OperationStatus.
   */
  async fetchBundlerOperationStatus(
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
        retries: 5,
      }
    );
  }

  /**
   * Start syncing process, returning current merkle index at tip of chain and iterator
   * returning newly synced merkle indices as syncing process occurs.
   */
  async syncWithProgress(syncOpts: SyncOpts): Promise<SyncWithProgressOutput> {
    let latestMerkleIndexOnChain =
      (await this.handlerContract.totalCount()).toNumber() - 1;
    let latestSyncedMerkleIndex =
      (await this.getLatestSyncedMerkleIndex()) ?? 0;

    const NUM_REFETCHES = 5;
    const refetchEvery = Math.floor(
      (latestMerkleIndexOnChain - latestSyncedMerkleIndex) / NUM_REFETCHES
    );

    let closed = false;
    const generator = async function* (sdk: NocturneFrontendSDK) {
      let count = 0;
      while (!closed && latestSyncedMerkleIndex < latestMerkleIndexOnChain) {
        latestSyncedMerkleIndex = (await sdk.sync(syncOpts)) ?? 0;

        if (count % refetchEvery === 0) {
          latestMerkleIndexOnChain =
            (await sdk.handlerContract.totalCount()).toNumber() - 1;
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
    const latestSyncedMerkleIndexJson = (await window.ethereum.request({
      method: "wallet_invokeSnap",
      params: {
        snapId: SNAP_ID,
        request: {
          method: "nocturne_sync",
          params: {
            syncOpts: syncOpts ? JSON.stringify(syncOpts) : undefined,
          },
        },
      },
    })) as string;

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
    const latestSyncedMerkleIndexJson = (await window.ethereum.request({
      method: "wallet_invokeSnap",
      params: {
        snapId: SNAP_ID,
        request: {
          method: "nocturne_getLatestSyncedMerkleIndex",
        },
      },
    })) as string;

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
    const json = (await window.ethereum.request({
      method: "wallet_invokeSnap",
      params: {
        snapId: SNAP_ID,
        request: {
          method: "nocturne_getRandomizedAddr",
        },
      },
    })) as string;

    return JSON.parse(json) as StealthAddress;
  }

  /**
   * Query subgraph for all spender's deposits
   */
  async fetchAllDeposits(): Promise<DepositEvent[]> {
    const withEntityIndices = await fetchDepositEvents(SUBGRAPH_URL, {
      spender: await (await getWindowSigner()).getAddress(),
    });

    return withEntityIndices.map((e) => e.inner);
  }
  /**
   * Retrieve a `SignedOperation` from the snap given an `OperationRequest`.
   * This includes all joinsplit tx inputs.
   *
   * @param operationRequest Operation request
   */
  protected async requestSignOperation(
    operationRequest: OperationRequestWithMetadata
  ): Promise<SignedOperation> {
    console.log("[fe-sdk] metadata:", operationRequest.meta);
    const json = (await window.ethereum.request({
      method: "wallet_invokeSnap",
      params: {
        snapId: SNAP_ID,
        request: {
          method: "nocturne_signOperation",
          params: {
            operationRequest: JSON.stringify(operationRequest.request),
            opMetadata: JSON.stringify(operationRequest.meta),
          },
        },
      },
    })) as string;

    return JSON.parse(json) as SignedOperation;
  }

  private formInitiateDepositResult(
    spender: string,
    tx: ContractTransaction,
    value: bigint,
    depositAddr: CompressedStealthAddress,
    assetAddr: string,
    gasCompensation: bigint
  ): InitiateDepositResult {
    const depositRequest: DepositRequest = {
      spender,
      encodedAsset: AssetTrait.encode({
        assetType: AssetType.ERC20,
        assetAddr: assetAddr,
        id: 0n, // TODO what is id?
      }),
      value,
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
