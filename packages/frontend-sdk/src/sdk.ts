import {
  OperationRequest,
  ProvenOperation,
  SignedOperation,
  StealthAddress,
  AssetWithBalance,
  AssetTrait,
  AssetType,
  Address,
  JoinSplitProofWithPublicSignals,
  unpackFromSolidityProof,
  joinSplitPublicSignalsToArray,
  VerifyingKey,
  computeOperationDigest,
  proveOperation,
} from "@nocturne-xyz/sdk";
import {
  DEFAULT_SNAP_ORIGIN,
  getTokenContract,
  getWindowSigner,
} from "./common";
import { WasmJoinSplitProver } from "@nocturne-xyz/local-prover";
import * as JSON from "bigint-json-serialization";
import { Wallet, Wallet__factory } from "@nocturne-xyz/contracts";
import { ContractTransaction } from "ethers";

const WASM_PATH = "/joinsplit.wasm";
const ZKEY_PATH = "/joinsplit.zkey";
const VKEY_PATH = "/joinSplitVkey.json";

export type BundlerOperationID = string;

export class NocturneFrontendSDK {
  localProver: WasmJoinSplitProver;
  bundlerEndpoint: string;
  walletContract: Wallet;
  vaultContractAddress: Address;

  private constructor(
    bundlerEndpoint: string,
    walletContract: Wallet,
    vaultContractAddress: string,
    wasmPath: string,
    zkeyPath: string,
    vkey: VerifyingKey
  ) {
    this.localProver = new WasmJoinSplitProver(wasmPath, zkeyPath, vkey);
    this.bundlerEndpoint = bundlerEndpoint;
    this.walletContract = walletContract;
    this.vaultContractAddress = vaultContractAddress;
  }

  /**
   * Instantiate new `NocturneFrontendSDK` instance.
   *
   * @param walletContractAddress Wallet contract address
   * @param wasPath Joinsplit wasm path
   * @param zkeyPath Joinsplit zkey path
   * @param vkey Vkey object
   */
  static async instantiate(
    bundlerEndpoint: string,
    walletContractAddress: string,
    vaultContractAddress: string,
    wasmPath: string,
    zkeyPath: string,
    vkey: any
  ): Promise<NocturneFrontendSDK> {
    const walletContract = await NocturneFrontendSDK.connectWalletContract(
      walletContractAddress
    );
    return new NocturneFrontendSDK(
      bundlerEndpoint,
      walletContract,
      vaultContractAddress,
      wasmPath,
      zkeyPath,
      vkey
    );
  }

  private static async connectWalletContract(
    walletContractAddress: string
  ): Promise<Wallet> {
    const signer = await getWindowSigner();
    return Wallet__factory.connect(walletContractAddress, signer);
  }

  /**
   * Call `walletContract.depositFunds` given the provided `assetType`,
   * `assetAddress`, `value`, and `assetId`.
   *
   * @param assetType Asset type
   * @param assetAddress Asset address
   * @param value Asset amount
   * @param assetId Asset id
   */
  async depositFunds(
    assetType: AssetType,
    assetAddress: Address,
    assetId: bigint,
    value: bigint
  ): Promise<ContractTransaction> {
    const spender = await this.walletContract.signer.getAddress();
    const depositAddr = await this.getRandomizedAddr();
    const { encodedAssetAddr, encodedAssetId } = AssetTrait.encode({
      assetType,
      assetAddr: assetAddress,
      id: assetId,
    });

    const signer = await getWindowSigner();
    const tokenContract = getTokenContract(assetType, assetAddress, signer);
    if (assetType == AssetType.ERC20) {
      await tokenContract.approve(this.vaultContractAddress, value);
    } else if (assetType == AssetType.ERC721) {
      await tokenContract.approve(this.vaultContractAddress, assetId);
    } else if (assetType == AssetType.ERC1155) {
      await tokenContract.setApprovalForAll(this.vaultContractAddress, true);
    }

    return this.walletContract.depositFunds({
      spender,
      encodedAssetAddr,
      encodedAssetId,
      value,
      depositAddr,
    });
  }

  /**
   * Generate `ProvenOperation` given an `operationRequest`.
   *
   * @param operationRequest Operation request
   */
  async signAndProveOperation(
    operationRequest: OperationRequest
  ): Promise<ProvenOperation> {
    const op = await this.requestSignOperation(
      operationRequest
    );

    console.log("SignedOperation", op);
    return await this.proveOperation(op);
  }

  async proveOperation(op: SignedOperation): Promise<ProvenOperation> {
    return await proveOperation(op, this.localProver);
  }

  async verifyProvenOperation(operation: ProvenOperation): Promise<boolean> {
    console.log("ProvenOperation", operation);
    const opDigest = computeOperationDigest(operation);

    const proofsWithPublicInputs: JoinSplitProofWithPublicSignals[] =
      operation.joinSplits.map((joinSplit) => {
        const publicSignals = joinSplitPublicSignalsToArray({
          newNoteACommitment: joinSplit.newNoteACommitment,
          newNoteBCommitment: joinSplit.newNoteBCommitment,
          commitmentTreeRoot: joinSplit.commitmentTreeRoot,
          publicSpend: joinSplit.publicSpend,
          nullifierA: joinSplit.nullifierA,
          nullifierB: joinSplit.nullifierB,
          opDigest,
          encodedAssetAddr: joinSplit.encodedAsset.encodedAssetAddr,
          encodedAssetId: joinSplit.encodedAsset.encodedAssetId,
        });

        const proof = unpackFromSolidityProof(joinSplit.proof);

        return { proof, publicSignals };
      });

    const results = await Promise.all(
      proofsWithPublicInputs.map(async (proofWithPis) => {
        return await this.localProver.verifyJoinSplitProof(proofWithPis);
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
      body: JSON.stringify(operation),
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
      params: [
        DEFAULT_SNAP_ORIGIN,
        {
          method: "nocturne_getAllBalances",
        },
      ],
    })) as string;

    return JSON.parse(json) as AssetWithBalance[];
  }

  /**
   * Invoke snap `syncNotes` method.
   */
  async syncNotes(): Promise<void> {
    await window.ethereum.request({
      method: "wallet_invokeSnap",
      params: [
        DEFAULT_SNAP_ORIGIN,
        {
          method: "nocturne_syncNotes",
        },
      ],
    });
  }

  /**
   * Invoke snap `syncLeaves` method.
   */
  async syncLeaves(): Promise<void> {
    await window.ethereum.request({
      method: "wallet_invokeSnap",
      params: [
        DEFAULT_SNAP_ORIGIN,
        {
          method: "nocturne_syncLeaves",
        },
      ],
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
      params: [
        DEFAULT_SNAP_ORIGIN,
        {
          method: "nocturne_getJoinSplitInputs",
          params: { operationRequest: JSON.stringify(operationRequest) },
        },
      ],
    })) as string;

    return JSON.parse(json) as SignedOperation;
  }

  /**
   * Retrieve a freshly randomized address from the snap.
   */
  protected async getRandomizedAddr(): Promise<StealthAddress> {
    const json = (await window.ethereum.request({
      method: "wallet_invokeSnap",
      params: [
        DEFAULT_SNAP_ORIGIN,
        {
          method: "nocturne_getRandomizedAddr",
        },
      ],
    })) as string;

    return JSON.parse(json) as StealthAddress;
  }
}

/**
 * Load a `NocturneFrontendSDK` instance, provided a wallet contract
 * address, vault contract address, and paths to local prover's wasm, zkey, and
 * vkey. Circuit file paths default to caller's current directory (joinsplit.
 * wasm, joinsplit.zkey, joinSplitVkey.json).
 *
 * @param wasmPath Wasm path
 * @param zkeyPath Zkey path
 * @param vkeyPath Vkey path
 */
export async function loadNocturneFrontendSDK(
  bundlerEndpoint: string,
  walletContractAddress: string,
  vaultContractAddress: string,
  wasmPath: string = WASM_PATH,
  zkeyPath: string = ZKEY_PATH,
  vkeyPath: string = VKEY_PATH
): Promise<NocturneFrontendSDK> {
  const vkey = JSON.parse(await (await fetch(vkeyPath)).text());
  return await NocturneFrontendSDK.instantiate(
    bundlerEndpoint,
    walletContractAddress,
    vaultContractAddress,
    wasmPath,
    zkeyPath,
    vkey as VerifyingKey
  );
}
