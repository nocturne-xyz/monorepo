import { ethers } from "ethers";
import { UnprovenOperation, UnprovenSpendTransaction } from "./types";

export function hashOperation(op: UnprovenOperation): string {
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

export function hashSpend(spend: UnprovenSpendTransaction): string {
  const payload = ethers.utils.solidityPack(
    ["uint256", "uint256", "uint256", "uint256", "address", "uint256"],
    [
      spend.commitmentTreeRoot,
      spend.nullifier,
      spend.newNoteCommitment,
      spend.value,
      spend.asset,
      spend.id,
    ]
  );

  return ethers.utils.keccak256(payload);
}

export function calculateOperationDigest(
  operationHash: string,
  spendHash: string
): string {
  return ethers.utils.keccak256(
    ethers.utils.solidityPack(
      ["bytes32", "bytes32"],
      [operationHash, spendHash]
    )
  );
}
