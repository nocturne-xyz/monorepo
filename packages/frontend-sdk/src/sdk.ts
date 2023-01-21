import {
  OperationRequest,
  ProvenOperation,
  ProvenJoinSplitTx,
  PreProofOperation,
  NocturneAddress,
  AssetWithBalance,
  encodeAsset,
  proveJoinSplitTx,
  calculateOperationDigest,
  JoinSplitProofWithPublicSignals,
  unpackFromSolidityProof,
  joinSplitPublicSignalsToArray,
} from "@nocturne-xyz/sdk";
import { DEFAULT_SNAP_ORIGIN } from "./common";
import { LocalJoinSplitProver } from "@nocturne-xyz/local-prover";
import * as JSON from "bigint-json-serialization";

const WASM_PATH = "/joinsplit.wasm";
const ZKEY_PATH = "/joinsplit.zkey";
const VKEY_PATH = "/joinSplitVkey.json";

export type BundlerOperationID = string;

export class NocturneFrontendSDK {
  localProver: LocalJoinSplitProver;
  bundlerEndpoint: string;

  constructor(bundlerEndpoint: string, wasmPath: string, zkeyPath: string, vkey: any) {
    this.localProver = new LocalJoinSplitProver(wasmPath, zkeyPath, vkey);
    this.bundlerEndpoint = bundlerEndpoint;
  }

  /**
   * Generate `ProvenOperation` given an `operationRequest`.
   *
   * @param operationRequest Operation request
   */
  async generateProvenOperation(
    operationRequest: OperationRequest
  ): Promise<ProvenOperation> {
    const joinSplitInputs = await this.getJoinSplitInputsFromSnap(
      operationRequest
    );

    const provenJoinSplitPromises: Promise<ProvenJoinSplitTx>[] =
      joinSplitInputs.joinSplitTxs.map((inputs) => proveJoinSplitTx(this.localProver, inputs));

    const {
      joinSplitRequests,
      refundAssets,
      actions,
      verificationGasLimit = 1_000_000n,
      executionGasLimit = 1_000_000n,
      gasPrice = 0n,
      maxNumRefunds = BigInt(refundAssets.length + joinSplitRequests.length),
    } = operationRequest;

    const encodedRefundAssets = refundAssets.map(encodeAsset);

    const joinSplitTxs = await Promise.all(provenJoinSplitPromises);
    const refundAddr = await this.getRandomizedAddr();
    return {
      joinSplitTxs,
      refundAddr,
      encodedRefundAssets,
      actions,
      verificationGasLimit,
      executionGasLimit,
      gasPrice,
      maxNumRefunds,
    };
  }

  async verifyProvenOperation(
    operation: ProvenOperation
  ): Promise<boolean> {
    const opDigest = calculateOperationDigest(operation);
    const proofsWithPublicInputs: JoinSplitProofWithPublicSignals[] = operation.joinSplitTxs.map((joinSplit) => {
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
      console.log("proof", proof);

      return { publicSignals, proof };
    });

    const results = await Promise.all(
      proofsWithPublicInputs.map(this.localProver.verifyJoinSplitProof)
    );

    return results.every((result) => result);
  }

  // Submit a proven operation to the bundler server
  // returns the bundler's ID for the submitted operation, which can be used to check the status of the operation
  async submitProvenOperation(operation: ProvenOperation): Promise<BundlerOperationID> {
    const res = await fetch(`${this.bundlerEndpoint}/relay`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(operation),
    });

    const resJSON = await res.json();
    if (!res.ok) {
      throw new Error(`Failed to submit proven operation to bundler: ${JSON.stringify(resJSON)}`);
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
   * Retrieve a `PreProofOperation` from the snap given an `OperationRequest`.
   * This includes all joinsplit tx inputs.
   *
   * @param operationRequest Operation request
   */
  protected async getJoinSplitInputsFromSnap(
    operationRequest: OperationRequest
  ): Promise<PreProofOperation> {
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

    return JSON.parse(json) as PreProofOperation;
  }

  /**
   * Retrieve a freshly randomized address from the snap.
   */
  protected async getRandomizedAddr(): Promise<NocturneAddress> {
    const json = (await window.ethereum.request({
      method: "wallet_invokeSnap",
      params: [
        DEFAULT_SNAP_ORIGIN,
        {
          method: "nocturne_getRandomizedAddr",
        },
      ],
    })) as string;

    return JSON.parse(json) as NocturneAddress;
  }
}

/**
 * Load a `NocturneFrontendSDK` instance, provided paths to local prover's wasm,
 * zkey, and vkey. Circuit file paths default to caller's current directory
 * (joinsplit.wasm, joinsplit.zkey, joinSplitVkey.json).
 *
 * @param wasmPath Wasm path
 * @param zkeyPath Zkey path
 * @param vkeyPath Vkey path
 */
export async function loadNocturneFrontendSDK(
  bundlerEndpoint: string,
  wasmPath: string = WASM_PATH,
  zkeyPath: string = ZKEY_PATH,
  vkeyPath: string = VKEY_PATH
): Promise<NocturneFrontendSDK> {
  const vkey = JSON.parse(await (await fetch(vkeyPath)).text());
  return new NocturneFrontendSDK(bundlerEndpoint, wasmPath, zkeyPath, vkey);
}
