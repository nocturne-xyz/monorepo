import { ethers } from "ethers";
import { SNARK_SCALAR_FIELD } from "../commonTypes";
import { PreProofOperation, PreProofSpendTransaction } from "./types";

function hashOperation(op: PreProofOperation): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let payload = [] as any;
  for (let i = 0; i < op.actions.length; i++) {
    const action = op.actions[i];
    payload = ethers.utils.solidityPack(
      ["bytes", "address", "bytes32"],
      [
        payload,
        action.contractAddress,
        ethers.utils.keccak256(action.encodedFunction),
      ]
    );
  }

  const spendTokensHash = ethers.utils.keccak256(
    ethers.utils.solidityPack(["address[]"], [op.tokens.spendTokens])
  );
  const refundTokensHash = ethers.utils.keccak256(
    ethers.utils.solidityPack(["address[]"], [op.tokens.refundTokens])
  );

  payload = ethers.utils.solidityPack(
    [
      "bytes",
      "uint256",
      "uint256",
      "uint256",
      "uint256",
      "bytes32",
      "bytes32",
      "uint256",
    ],
    [
      payload,
      op.refundAddr.h1X,
      op.refundAddr.h1Y,
      op.refundAddr.h2X,
      op.refundAddr.h2Y,
      spendTokensHash,
      refundTokensHash,
      op.gasLimit,
    ]
  );

  return ethers.utils.keccak256(payload);
}

function hashSpend(spend: PreProofSpendTransaction): string {
  const payload = ethers.utils.solidityPack(
    ["uint256", "uint256", "uint256", "uint256", "address", "uint256"],
    [
      spend.commitmentTreeRoot,
      spend.nullifier,
      spend.newNoteCommitment,
      spend.valueToSpend,
      spend.asset,
      spend.id,
    ]
  );

  return ethers.utils.keccak256(payload);
}

function calcOperationDigest(operationHash: string, spendHash: string): string {
  return ethers.utils.keccak256(
    ethers.utils.solidityPack(
      ["bytes32", "bytes32"],
      [operationHash, spendHash]
    )
  );
}

export function calculateOperationDigest(
  operation: PreProofOperation,
  spend: PreProofSpendTransaction
): bigint {
  const operationHash = hashOperation(operation);
  const spendHash = hashSpend(spend);
  return (
    BigInt(calcOperationDigest(operationHash, spendHash)) % SNARK_SCALAR_FIELD
  );
}
