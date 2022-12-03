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
import { joinSplitProver } from "@nocturne-xyz/local-prover";
import JSON from "json-bigint";

export class NocturneFrontendSDK {
  async generateProvenOperation(
    operationRequest: OperationRequest,
    wasmPath: string,
    zkeyPath: string,
    gasLimit = 1_000_000n
  ): Promise<ProvenOperation> {
    const joinSplitInputs = await this.getJoinSplitInputsFromSnap(
      operationRequest
    );

    const provenJoinSplitPromises: Promise<ProvenJoinSplitTx>[] =
      joinSplitInputs.joinSplitTxs.map(
        async ({ proofInputs, ...joinSplitTx }) => {
          const { proof } = await joinSplitProver.proveJoinSplit(
            proofInputs,
            wasmPath,
            zkeyPath
          );

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

export const nocturneFrontendSDK = new NocturneFrontendSDK();
