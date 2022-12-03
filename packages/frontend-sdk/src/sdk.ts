import {
  OperationRequest,
  packToSolidityProof,
  ProvenOperation,
  ProvenJoinSplitTx,
  toJSON,
  PreProofOperation,
  SpendAndRefundTokens,
} from "@nocturne-xyz/sdk";
import { DEFAULT_SNAP_ORIGIN } from "./common";
import { joinSplitProver } from "@nocturne-xyz/local-prover";

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
    return {
      joinSplitTxs,
      refundAddr: {
        h1X: 0n,
        h1Y: 0n,
        h2X: 0n,
        h2Y: 0n,
      },
      tokens,
      actions,
      gasLimit,
    };
  }

  protected async getJoinSplitInputsFromSnap(
    operationRequest: OperationRequest
  ): Promise<PreProofOperation> {
    return (await window.ethereum.request({
      method: "wallet_invokeSnap",
      params: [
        DEFAULT_SNAP_ORIGIN,
        {
          method: "nocturne_getJoinSplitInputs",
          params: { operationRequest: toJSON(operationRequest) },
        },
      ],
    })) as PreProofOperation;
  }

  // protected async getRandomizedAddr(): Promise<NocturneAddressStruct> {}
}

export const nocturneFrontendSDK = new NocturneFrontendSDK();
