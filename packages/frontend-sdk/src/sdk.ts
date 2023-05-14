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
import { SNAP_ID, getTokenContract, getWindowSigner } from "./utils";
import { WasmJoinSplitProver } from "@nocturne-xyz/local-prover";
import * as JSON from "bigint-json-serialization";
import { Teller, Teller__factory } from "@nocturne-xyz/contracts";
import { ContractTransaction } from "ethers";

const WASM_PATH = "/joinsplit.wasm";
const ZKEY_PATH = "/joinsplit.zkey";
const VKEY_PATH = "/joinSplitVkey.json";

export type BundlerOperationID = string;

export class NocturneFrontendSDK {
  joinSplitProver: WasmJoinSplitProver;
  bundlerEndpoint: string;
  tellerContract: Teller;

  private constructor(
    bundlerEndpoint: string,
    tellerContract: Teller,
    wasmPath: string,
    zkeyPath: string,
    vkey: VerifyingKey
  ) {
    this.joinSplitProver = new WasmJoinSplitProver(wasmPath, zkeyPath, vkey);
    this.bundlerEndpoint = bundlerEndpoint;
    this.tellerContract = tellerContract;
  }

  /**
   * Instantiate new `NocturneFrontendSDK` instance.
   *
   * @param tellerContractAddress Teller contract address
   * @param wasPath Joinsplit wasm path
   * @param zkeyPath Joinsplit zkey path
   * @param vkey Vkey object
   */
  static async instantiate(
    bundlerEndpoint: string,
    tellerContractAddress: string,
    wasmPath: string,
    zkeyPath: string,
    vkey: any
  ): Promise<NocturneFrontendSDK> {
    const tellerContract = await NocturneFrontendSDK.connectTellerContract(
      tellerContractAddress
    );
    return new NocturneFrontendSDK(
      bundlerEndpoint,
      tellerContract,
      wasmPath,
      zkeyPath,
      vkey
    );
  }

  private static async connectTellerContract(
    tellerContractAddress: string
  ): Promise<Teller> {
    const signer = await getWindowSigner();
    return Teller__factory.connect(tellerContractAddress, signer);
  }

  /**
   * Call `tellerContract.depositFunds` given the provided `assetType`,
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
    const spender = await this.tellerContract.signer.getAddress();
    const depositAddr = await this.getRandomizedAddr();
    const encodedAsset = AssetTrait.encode({
      assetType,
      assetAddr: assetAddress,
      id: assetId,
    });

    const signer = await getWindowSigner();
    const tokenContract = getTokenContract(assetType, assetAddress, signer);
    if (assetType == AssetType.ERC20) {
      await tokenContract.approve(this.tellerContract.address, value);
    } else if (assetType == AssetType.ERC721) {
      await tokenContract.approve(this.tellerContract.address, assetId);
    } else if (assetType == AssetType.ERC1155) {
      await tokenContract.setApprovalForAll(this.tellerContract.address, true);
    }

    // TODO: currently broken as is, fix once we have deposit screener agent
    return this.tellerContract.depositFunds({
      spender,
      encodedAsset,
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
          encSenderCanonAddrC1X: joinSplit.encSenderCanonAddrC1X,
          encSenderCanonAddrC2X: joinSplit.encSenderCanonAddrC2X,
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
 * @param wasmPath Wasm path
 * @param zkeyPath Zkey path
 * @param vkeyPath Vkey path
 */
export async function loadNocturneFrontendSDK(
  bundlerEndpoint: string,
  tellerContractAddress: string,
  wasmPath: string = WASM_PATH,
  zkeyPath: string = ZKEY_PATH,
  vkeyPath: string = VKEY_PATH
): Promise<NocturneFrontendSDK> {
  const vkey = JSON.parse(await (await fetch(vkeyPath)).text());
  return await NocturneFrontendSDK.instantiate(
    bundlerEndpoint,
    tellerContractAddress,
    wasmPath,
    zkeyPath,
    vkey as VerifyingKey
  );
}
