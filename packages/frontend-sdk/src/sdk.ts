import {
  OperationRequest,
  ProvenOperation,
  SignedOperation,
  StealthAddress,
  AssetWithBalance,
  AssetType,
  Address,
  JoinSplitProofWithPublicSignals,
  unpackFromSolidityProof,
  joinSplitPublicSignalsToArray,
  VerifyingKey,
  computeOperationDigest,
  proveOperation,
  DepositStatusResponse,
  DepositQuoteResponse,
  RelayRequest,
  OperationRequestBuilder,
  AssetTrait,
  StealthAddressTrait,
  encodeEncodedAssetAddrWithSignBitsPI,
  decomposeCompressedPoint,
} from "@nocturne-xyz/sdk";
import { SNAP_ID, getTokenContract, getWindowSigner } from "./utils";
import { WasmJoinSplitProver } from "@nocturne-xyz/local-prover";
import * as JSON from "bigint-json-serialization";
import {
  DepositManager,
  DepositManager__factory,
} from "@nocturne-xyz/contracts";
import { ContractTransaction } from "ethers";

const WASM_PATH = "/joinsplit.wasm";
const ZKEY_PATH = "/joinsplit.zkey";
const VKEY_PATH = "/joinSplitVkey.json";

const ONE_DAY_SECONDS = 24 * 60 * 60;

export type BundlerOperationID = string;

export interface Endpoints {
  screenerEndpoint: string;
  bundlerEndpoint: string;
}

export class NocturneFrontendSDK {
  joinSplitProver: WasmJoinSplitProver;
  depositManagerContract: DepositManager;
  bundlerEndpoint: string;
  screenerEndpoint: string;

  private constructor(
    depositManagerContract: DepositManager,
    endpoints: Endpoints,
    wasmPath: string,
    zkeyPath: string,
    vkey: VerifyingKey
  ) {
    this.joinSplitProver = new WasmJoinSplitProver(wasmPath, zkeyPath, vkey);
    this.depositManagerContract = depositManagerContract;
    this.screenerEndpoint = endpoints.screenerEndpoint;
    this.bundlerEndpoint = endpoints.bundlerEndpoint;
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
    depositManagerAddress: string,
    endpoints: Endpoints,
    wasmPath: string,
    zkeyPath: string,
    vkey: any
  ): Promise<NocturneFrontendSDK> {
    const signer = await getWindowSigner();
    const depositManagerContract = DepositManager__factory.connect(
      depositManagerAddress,
      signer
    );
    return new NocturneFrontendSDK(
      depositManagerContract,
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

    const depositAddr = StealthAddressTrait.compress(await this.getRandomizedAddr());
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

    const depositAddr = StealthAddressTrait.compress(await this.getRandomizedAddr());
    return this.depositManagerContract.instantiateErc20MultiDeposit(
      erc20Address,
      values,
      depositAddr
    );
  }

  async transferErc20(
    erc20Address: Address,
    amount: bigint,
    toAddress: Address
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
      [toAddress, amount]
    );

    const encodedErc20 = AssetTrait.erc20AddressToAsset(erc20Address);

    const chainId = BigInt((await provider.getNetwork()).chainId);
    const deadline = BigInt(
      (await provider.getBlock("latest")).timestamp + ONE_DAY_SECONDS
    );

    const operationRequest = new OperationRequestBuilder()
      .unwrap(encodedErc20, amount)
      .action(erc20Address, encodedFunction)
      .maxNumRefunds(1n)
      .gas({ executionGasLimit: 500_000n, gasPrice: 0n })
      .chainId(chainId)
      .deadline(deadline)
      .build();

    const provenOperation = await this.signAndProveOperation(operationRequest);
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
    const res = await fetch(
      `http://${this.screenerEndpoint}/status/${depositHash}`,
      {
        method: "GET",
      }
    );
    return (await res.json()) as DepositStatusResponse;
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

    const res = await fetch(`http://${this.screenerEndpoint}/quote`, {
      method: "GET",
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
  }

  /**
   * Generate `ProvenOperation` given an `operationRequest`.
   *
   * @param operationRequest Operation request
   */
  async signAndProveOperation(
    operationRequest: OperationRequest
  ): Promise<ProvenOperation> {
    const op = await this.requestSignOperation(operationRequest);

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
        const encodedAssetAddrWithSignBits = encodeEncodedAssetAddrWithSignBitsPI(joinSplit.encodedAsset.encodedAssetAddr, encSenderCanonAddr);

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
        `Failed to submit proven operation to bundler: ${JSON.stringify(
          resJSON
        )}`
      );
    }

    return resJSON.id;
  }

  /**
   * Return a list of snap's assets (address & id) along with its given balance.
   */
  async getAllBalances(): Promise<AssetWithBalance[]> {
    const json = (await window.ethereum.request({
      method: "wallet_invokeSnap",
      params: {
        snapId: SNAP_ID,
        request: {
          method: "nocturne_getAllBalances",
        },
      },
    })) as string;

    return JSON.parse(json) as AssetWithBalance[];
  }

  /**
   * Invoke snap `syncNotes` method.
   */
  async sync(): Promise<void> {
    await window.ethereum.request({
      method: "wallet_invokeSnap",
      params: {
        snapId: SNAP_ID,
        request: {
          method: "nocturne_sync",
        },
      },
    });
  }

  /**
   * Retrieve a `SignedOperation` from the snap given an `OperationRequest`.
   * This includes all joinsplit tx inputs.
   *
   * @param operationRequest Operation request
   */
  protected async requestSignOperation(
    operationRequest: OperationRequest
  ): Promise<SignedOperation> {
    const json = (await window.ethereum.request({
      method: "wallet_invokeSnap",
      params: {
        snapId: SNAP_ID,
        request: {
          method: "nocturne_signOperation",
          params: { operationRequest: JSON.stringify(operationRequest) },
        },
      },
    })) as string;

    return JSON.parse(json) as SignedOperation;
  }

  /**
   * Retrieve a freshly randomized address from the snap.
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
  depositManagerAddress: Address,
  endpoints: Endpoints,
  wasmPath: string = WASM_PATH,
  zkeyPath: string = ZKEY_PATH,
  vkeyPath: string = VKEY_PATH
): Promise<NocturneFrontendSDK> {
  const vkey = JSON.parse(await (await fetch(vkeyPath)).text());
  return await NocturneFrontendSDK.instantiate(
    depositManagerAddress,
    endpoints,
    wasmPath,
    zkeyPath,
    vkey as VerifyingKey
  );
}
