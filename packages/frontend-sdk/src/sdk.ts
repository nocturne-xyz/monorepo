import {
  OperationRequest,
  packToSolidityProof,
  ProvenOperation,
  ProvenJoinSplitTx,
  PreProofOperation,
  SpendAndRefundTokens,
  NocturneAddress,
  AssetWithBalance,
} from "@nocturne-xyz/sdk";
import { DEFAULT_SNAP_ORIGIN } from "./common";
import { LocalJoinSplitProver } from "@nocturne-xyz/local-prover";
import * as JSON from "bigint-json-serialization";

const WASM_PATH = "./joinsplit.wasm";
const ZKEY_PATH = "./joinsplit.zkey";
const VKEY_PATH = "./joinSplitVkey.json";

export class NocturneFrontendSDK {
  localProver: LocalJoinSplitProver;

  constructor(wasmPath: string, zkeyPath: string, vkey: any) {
    this.localProver = new LocalJoinSplitProver(wasmPath, zkeyPath, vkey);
  }

  /**
   * Generate `ProvenOperation` given an `operationRequest`.
   *
   * @param operationRequest Operation request
   */
  async generateProvenOperation(
    operationRequest: OperationRequest,
    gasLimit = 1_000_000n
  ): Promise<ProvenOperation> {
    const joinSplitInputs = await this.getJoinSplitInputsFromSnap(
      operationRequest
    );

    const provenJoinSplitPromises: Promise<ProvenJoinSplitTx>[] =
      joinSplitInputs.joinSplitTxs.map(
        async ({ proofInputs, ...joinSplitTx }) => {
          const { proof } = await this.localProver.proveJoinSplit(proofInputs);

          return {
            proof: packToSolidityProof(proof),
            ...joinSplitTx,
          };
        }
      );

    const { joinSplitRequests, refundTokens, actions } = operationRequest;
    const tokens: SpendAndRefundTokens = {
      spendTokens: joinSplitRequests.map((a) => a.asset.address),
      refundTokens,
    };

    const joinSplitTxs = await Promise.all(provenJoinSplitPromises);
    const refundAddr = await this.getRandomizedAddr();
    return {
      joinSplitTxs,
      refundAddr,
      tokens,
      actions,
      gasLimit,
    };
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
  wasmPath: string = WASM_PATH,
  zkeyPath: string = ZKEY_PATH,
  vkeyPath: string = VKEY_PATH
): Promise<NocturneFrontendSDK> {
  const vkey = JSON.parse(await (await fetch(vkeyPath)).text());
  return new NocturneFrontendSDK(wasmPath, zkeyPath, vkey);
}
