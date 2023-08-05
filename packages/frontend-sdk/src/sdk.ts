import { NocturneConfig } from "@nocturne-xyz/config";
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
  joinSplitPublicSignalsToArray,
  proveOperation,
  unpackFromSolidityProof,
} from "@nocturne-xyz/sdk";
import retry from "async-retry";
import * as JSON from "bigint-json-serialization";
import { ContractTransaction } from "ethers";
import {
  SNAP_ID,
  SUBGRAPH_URL,
  getTokenContract,
  getWindowSigner,
} from "./utils";

const WASM_PATH = "/joinsplit.wasm";
const ZKEY_PATH = "/joinsplit.zkey";
const VKEY_PATH = "/joinSplitVkey.json";

export type BundlerOperationID = string;

export interface Endpoints {
  screenerEndpoint: string;
  bundlerEndpoint: string;
}

export interface ContractAddresses {
  depositManagerAddress: string;
  handlerAddress: string;
}

export interface SyncProgress {
  latestSyncedMerkleIndex: number;
}

export interface SyncWithProgressOutput {
  latestSyncedMerkleIndex: number;
  latestMerkleIndexOnChain: number;
  progressIter: ClosableAsyncIterator<SyncProgress>;
}

export class NocturneFrontendSDK {
  joinSplitProver: WasmJoinSplitProver;
  depositManagerContract: DepositManager;
  handlerContract: Handler;
  bundlerEndpoint: string;
  screenerEndpoint: string;

  private constructor(
    depositManagerContract: DepositManager,
    handlerContract: Handler,
    endpoints: Endpoints,
    wasmPath: string,
    zkeyPath: string,
    vkey: VerifyingKey
  ) {
    this.joinSplitProver = new WasmJoinSplitProver(wasmPath, zkeyPath, vkey);
    this.depositManagerContract = depositManagerContract;
    this.depositManagerContract = depositManagerContract;
    this.handlerContract = handlerContract;
    this.screenerEndpoint = endpoints.screenerEndpoint;
    this.bundlerEndpoint = endpoints.bundlerEndpoint;
    this.joinSplitProver = new WasmJoinSplitProver(wasmPath, zkeyPath, vkey);
  }

  /**
   * Instantiate new `NocturneFrontendSDK` instance.
   *
   * @param depositManagerContractAddress Teller contract address
   * @param screenerEndpoint Screener endpoint
   * @param bundlerEndpoint Bundler endpoint
   * @param wasPath Joinsplit wasm path
   * @param zkeyPath Joinsplit zkey path
   * @param vkey Vkey object
   */
  static async instantiate(
    config: NocturneConfig,
    endpoints: Endpoints,
    wasmPath: string,
    zkeyPath: string,
    vkey: any
  ): Promise<NocturneFrontendSDK> {
    const signer = await getWindowSigner();

    const depositManagerAddress = config.depositManagerAddress();
    const depositManagerContract = DepositManager__factory.connect(
      depositManagerAddress,
      signer
    );

    const handlerAddress = config.handlerAddress();
    const handlerContract = Handler__factory.connect(handlerAddress, signer);

    return new NocturneFrontendSDK(
      depositManagerContract,
      handlerContract,
      endpoints,
      wasmPath,
      zkeyPath,
      vkey
    );
  }

  /**
   * Call `depositManager.instantiateErc20MultiDeposit` given the provided
   * `erc20Address`, `valuse`, and `gasCompPerDeposit`.
   *
   * @param values Asset amounts
   * @param gasCompensationPerDeposit Gas compensation per deposit
   */
  async instantiateETHDeposits(
    values: bigint[],
    gasCompensationPerDeposit: bigint
  ): Promise<ContractTransaction> {
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
      await this.getRandomizedAddr()
    );
    return this.depositManagerContract.instantiateETHMultiDeposit(
      values,
      depositAddr,
      { value: totalValue }
    );
  }

  /**
   * Call `depositManager.instantiateErc20MultiDeposit` given the provided
   * `erc20Address`, `valuse`, and `gasCompPerDeposit`.
   *
   * @param erc20Address Asset address
   * @param values Asset amounts
   * @param gasCompensationPerDeposit Gas compensation per deposit
   */
  async instantiateErc20Deposits(
    erc20Address: Address,
    values: bigint[],
    gasCompensationPerDeposit: bigint
  ): Promise<ContractTransaction> {
    const signer = await getWindowSigner();
    const gasCompRequired = gasCompensationPerDeposit * BigInt(values.length);

    const signerBalance = (await signer.getBalance()).toBigInt();
    if (signerBalance < gasCompRequired) {
      throw new Error(
        `signer does not have enough balance for gas comp. balance: ${signerBalance}. gasComp required: ${gasCompRequired}`
      );
    }

    const totalValue = values.reduce((acc, val) => acc + val, 0n);

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
      await this.getRandomizedAddr()
    );
    return this.depositManagerContract.instantiateErc20MultiDeposit(
      erc20Address,
      values,
      depositAddr
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
   * Initiates a deposit retrieval from the deposit manager contract.
   */
  async retrievePendingDeposit(
    req: DepositRequest
  ): Promise<ContractTransaction> {
    const signer = await (await getWindowSigner()).getAddress();
    if (signer.toLowerCase() !== req.spender.toLowerCase()) {
      throw new Error("Spender and signer addresses do not match");
    }
    return this.depositManagerContract.retrieveDeposit(req);
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
   * Query subgraph for all spender's deposits
   */
  async fetchAllDeposits(): Promise<DepositEvent[]> {
    const withEntityIndices = await fetchDepositEvents(SUBGRAPH_URL, {
      spender: await (await getWindowSigner()).getAddress(),
    });

    return withEntityIndices.map((e) => e.inner);
  }
  /**
   * Fetches a `SignedOperation` from the snap given an `OperationRequest`.
   * This includes all joinsplit tx inputs.
   *
   * @param operationRequest Operation request
   */
  protected async requestSignOperation(
    operationRequest: OperationRequest,
    opMetadata: OperationMetadata
  ): Promise<SignedOperation> {
    console.log("[fe-sdk] metadata:", opMetadata);
    const json = (await window.ethereum.request({
      method: "wallet_invokeSnap",
      params: {
        snapId: SNAP_ID,
        request: {
          method: "nocturne_signOperation",
          params: {
            operationRequest: JSON.stringify(operationRequest),
            opMetadata: JSON.stringify(opMetadata),
          },
        },
      },
    })) as string;

    return JSON.parse(json) as SignedOperation;
  }

  /**
   * Fetches a freshly randomized address from the snap.
   */
  protected async getRandomizedAddr(): Promise<StealthAddress> {
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
}

/**
 * Load a `NocturneFrontendSDK` instance, provided a teller contract
 * address and paths to local prover's wasm, zkey, and
 * vkey. Circuit file paths default to caller's current directory (joinsplit.
 * wasm, joinsplit.zkey, joinSplitVkey.json).
 *
 * @param depositManagerAddress Teller contract address
 * @param screenerEndpoint Screener endpoint
 * @param bundlerEndpoint Bundler endpoint
 * @param wasmPath Wasm path
 * @param zkeyPath Zkey path
 * @param vkeyPath Vkey path
 */
export async function loadNocturneFrontendSDK(
  config: NocturneConfig,
  endpoints: Endpoints,
  wasmPath: string = WASM_PATH,
  zkeyPath: string = ZKEY_PATH,
  vkeyPath: string = VKEY_PATH
): Promise<NocturneFrontendSDK> {
  const vkey = JSON.parse(await (await fetch(vkeyPath)).text());
  return await NocturneFrontendSDK.instantiate(
    config,
    endpoints,
    wasmPath,
    zkeyPath,
    vkey as VerifyingKey
  );
}
