import {
  OperationRequest,
  packToSolidityProof,
  ProvenOperation,
  ProvenJoinSplitTx,
  toJSON,
  PreProofOperation,
  SpendAndRefundTokens,
  preProofOperationFromJSON,
  NocturneAddress,
  nocturneAddressFromJSON,
  AssetWithBalance,
  assetWithBalanceFromJSON,
} from "@nocturne-xyz/sdk";
import { DEFAULT_SNAP_ORIGIN } from "./common";
import { LocalJoinSplitProver } from "@nocturne-xyz/local-prover";
import JSON from "json-bigint";

const WASM_PATH = "./joinsplit.wasm";
const ZKEY_PATH = "./joinsplit.zkey";
const VKEY_PATH = "./joinSplitVkey.json";

export class NocturneFrontendSDK {
  localProver: LocalJoinSplitProver;

  constructor(wasmPath: string, zkeyPath: string, vkey: any) {
    this.localProver = new LocalJoinSplitProver(wasmPath, zkeyPath, vkey);
  }

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

    const { assetRequests, refundTokens, actions } = operationRequest;
    const tokens: SpendAndRefundTokens = {
      spendTokens: assetRequests.map((a) => a.asset.address),
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

    return JSON.parse(json).map(assetWithBalanceFromJSON);
  }

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

  protected async getJoinSplitInputsFromSnap(
    operationRequest: OperationRequest
  ): Promise<PreProofOperation> {
    const json = await window.ethereum.request({
      method: "wallet_invokeSnap",
      params: [
        DEFAULT_SNAP_ORIGIN,
        {
          method: "nocturne_getJoinSplitInputs",
          params: { operationRequest: toJSON(operationRequest) },
        },
      ],
    });

    return preProofOperationFromJSON(json);
  }

  protected async getRandomizedAddr(): Promise<NocturneAddress> {
    const json = await window.ethereum.request({
      method: "wallet_invokeSnap",
      params: [
        DEFAULT_SNAP_ORIGIN,
        {
          method: "nocturne_getRandomizedAddr",
        },
      ],
    });

    return nocturneAddressFromJSON(json);
  }
}

export async function loadNocturneFrontendSDK(
  wasmPath: string = WASM_PATH,
  zkeyPath: string = ZKEY_PATH,
  vkeyPath: string = VKEY_PATH
): Promise<NocturneFrontendSDK> {
  const vkey = JSON.parse(await (await fetch(vkeyPath)).text());
  return new NocturneFrontendSDK(wasmPath, zkeyPath, vkey);
}
