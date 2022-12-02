import { ethers } from "ethers";
import {
  SNARK_SCALAR_FIELD,
  PreSignOperation,
  PreSignJoinSplitTx,
} from "../commonTypes";

function hashOperation(op: PreSignOperation): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let payload = [] as any;
  for (const action of op.actions) {
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

  let joinSplitTxsHash = [] as any;
  for (const tx of op.joinSplitTxs) {
    joinSplitTxsHash = ethers.utils.solidityPack(
      ["bytes", "bytes32"],
      [joinSplitTxsHash, hashJoinSplit(tx)]
    );
  }

  payload = ethers.utils.solidityPack(
    [
      "bytes",
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
      joinSplitTxsHash,
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

function hashJoinSplit(joinsplit: PreSignJoinSplitTx): string {
  const payload = ethers.utils.solidityPack(
    [
      "uint256",
      "uint256",
      "uint256",
      "uint256",
      "uint256",
      "uint256",
      "address",
      "uint256",
    ],
    [
      joinsplit.commitmentTreeRoot,
      joinsplit.nullifierA,
      joinsplit.nullifierB,
      joinsplit.newNoteACommitment,
      joinsplit.newNoteBCommitment,
      joinsplit.publicSpend,
      joinsplit.asset,
      joinsplit.id,
    ]
  );

  return ethers.utils.keccak256(payload);
}

export function calculateOperationDigest(operation: PreSignOperation): bigint {
  const operationHash = hashOperation(operation);
  return BigInt(operationHash) % SNARK_SCALAR_FIELD;
}
