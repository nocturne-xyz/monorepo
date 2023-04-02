import { ethers } from "ethers";
import {
  SNARK_SCALAR_FIELD,
  PreSignOperation,
  SignedOperation,
  ProvenOperation,
} from "./types";

export function computeOperationDigest(
  operation: PreSignOperation | SignedOperation | ProvenOperation
): bigint {
  const operationHash = hashOperation(operation);
  return BigInt(operationHash) % SNARK_SCALAR_FIELD;
}

function hashOperation(
  op: PreSignOperation | SignedOperation | ProvenOperation
): string {
  let joinSplitsPayload = [] as any;
  for (const joinsplit of op.joinSplits) {
    joinSplitsPayload = ethers.utils.solidityPack(
      ["bytes", "bytes32"],
      [
        joinSplitsPayload,
        ethers.utils.keccak256(
          ethers.utils.solidityPack(
            [
              "uint256",
              "uint256",
              "uint256",
              "uint256",
              "uint256",
              "uint256",
              "uint256",
              "uint256",
            ],
            [
              joinsplit.commitmentTreeRoot,
              joinsplit.nullifierA,
              joinsplit.nullifierB,
              joinsplit.newNoteACommitment,
              joinsplit.newNoteBCommitment,
              joinsplit.publicSpend,
              joinsplit.encodedAsset.encodedAssetAddr,
              joinsplit.encodedAsset.encodedAssetId,
            ]
          )
        ),
      ]
    );
  }

  const refundAddrPayload = ethers.utils.solidityPack(
    ["uint256", "uint256", "uint256", "uint256"],
    [op.refundAddr.h1X, op.refundAddr.h1Y, op.refundAddr.h2X, op.refundAddr.h2Y]
  );

  let refundAssetsPayload = [] as any;
  for (const encodedAsset of op.encodedRefundAssets) {
    refundAssetsPayload = ethers.utils.solidityPack(
      ["bytes", "uint256", "uint256"],
      [
        refundAssetsPayload,
        encodedAsset.encodedAssetAddr,
        encodedAsset.encodedAssetId,
      ]
    );
  }

  let actionsPayload = [] as any;
  for (const action of op.actions) {
    actionsPayload = ethers.utils.solidityPack(
      ["bytes", "address", "bytes32"],
      [
        actionsPayload,
        action.contractAddress,
        ethers.utils.keccak256(action.encodedFunction),
      ]
    );
  }

  const gasAssetPayload = ethers.utils.solidityPack(
    ["uint256", "uint256"],
    [op.encodedGasAsset.encodedAssetAddr, op.encodedGasAsset.encodedAssetId]
  );

  const payload = ethers.utils.solidityPack(
    [
      "bytes",
      "bytes",
      "bytes",
      "bytes",
      "bytes",
      "uint256",
      "uint256",
      "uint256",
      "uint256",
      "uint256",
    ],
    [
      joinSplitsPayload,
      refundAddrPayload,
      refundAssetsPayload,
      actionsPayload,
      gasAssetPayload,
      op.executionGasLimit,
      op.maxNumRefunds,
      op.gasPrice,
      op.chainId,
      op.deadline,
    ]
  );

  return ethers.utils.keccak256(payload);
}
