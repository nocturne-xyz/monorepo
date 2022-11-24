import { ethers } from "ethers";
import { SNARK_SCALAR_FIELD } from "../commonTypes";
import { PreProofOperation, PreProofJoinsplitTransaction } from "./types";

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

  const joinsplitHash = ethers.utils.keccak256(
    ethers.utils.solidityPack(["uint256[]"], op.joinsplitTxs.map(hashJoinsplit))
  );

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
      joinsplitHash,
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

function hashJoinsplit(joinsplit: PreProofJoinsplitTransaction): string {
  const payload = ethers.utils.solidityPack(
    ["uint256", "uint256", "uint256", "uint256", "uint256", "address", "uint256", "uint256"],
    [
      joinsplit.commitmentTreeRoot,
      joinsplit.nullifierA,
      joinsplit.nullifierB,
      joinsplit.newNoteACommitment,
      joinsplit.newNoteBCommitment,
      joinsplit.asset,
      joinsplit.id,
      joinsplit.publicSpend,
    ]
  );

  return ethers.utils.keccak256(payload);
}

export function calculateOperationDigest(
  operation: PreProofOperation,
): bigint {
  const operationHash = hashOperation(operation);
  return (
    BigInt(operationHash) % SNARK_SCALAR_FIELD
  );
}
