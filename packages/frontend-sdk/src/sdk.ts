import {
  OperationRequest,
  packToSolidityProof,
  ProvenOperation,
  ProvenSpendTx,
  spend2PublicSignalsArrayToTyped,
  SpendAndRefundTokens,
  toJSON,
} from "@nocturne-xyz/sdk";
import { PreProofSpendTxInputsAndProofInputs } from "@nocturne-xyz/sdk/dist/src/NocturneContext";
import { DEFAULT_SNAP_ORIGIN } from "./common";
import { spend2Prover } from "@nocturne-xyz/local-prover";

export class NocturneFrontendSDK {
  protected async generateProvenOperation(
    operationRequest: OperationRequest,
    gasLimit = 1_000_000n,
    wasmPath: string,
    zkeyPath: string
  ): Promise<ProvenOperation> {
    const spendInputs = await this.getSpendInputsFromSnap(operationRequest);

    const provenSpendTxPromises: Promise<ProvenSpendTx>[] = spendInputs.map(
      async ({ preProofSpendTxInputs, proofInputs }) => {
        const { proof, publicSignals } = await spend2Prover.proveSpend2(
          proofInputs,
          wasmPath,
          zkeyPath
        );

        const { anchor, nullifier, newNoteCommitment, valueToSpend, id } =
          spend2PublicSignalsArrayToTyped(publicSignals);

        return {
          commitmentTreeRoot: anchor,
          nullifier,
          newNoteCommitment,
          proof: packToSolidityProof(proof),
          asset: preProofSpendTxInputs.oldNewNotePair.oldNote.asset,
          valueToSpend,
          id,
        };
      }
    );

    const { assetRequests, refundTokens, actions } = operationRequest;
    const tokens: SpendAndRefundTokens = {
      spendTokens: assetRequests.map((a) => a.asset.address),
      refundTokens,
    };

    const spendTxs = await Promise.all(provenSpendTxPromises);
    return {
      spendTxs,
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

  protected async getSpendInputsFromSnap(
    operationRequest: OperationRequest
  ): Promise<PreProofSpendTxInputsAndProofInputs[]> {
    return (await window.ethereum.request({
      method: "wallet_invokeSnap",
      params: [
        DEFAULT_SNAP_ORIGIN,
        {
          method: "nocturne_getSpendInputs",
          params: { operationRequest: toJSON(operationRequest) },
        },
      ],
    })) as PreProofSpendTxInputsAndProofInputs[];
  }

  // protected async getRandomizedAddr(): Promise<NocturneAddressStruct> {}
}

export default new NocturneFrontendSDK();
