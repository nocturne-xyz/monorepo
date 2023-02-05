import { ethers } from "ethers";
import {
  SNARK_SCALAR_FIELD,
  PreSignOperation,
  PreProofOperation,
  ProvenOperation,
} from "../commonTypes";

function hashOperation(
  op: PreSignOperation | PreProofOperation | ProvenOperation
): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let actionPayload = [] as any;
  for (const action of op.actions) {
    actionPayload = ethers.utils.solidityPack(
      ["bytes", "address", "bytes32"],
      [
        actionPayload,
        action.contractAddress,
        ethers.utils.keccak256(action.encodedFunction),
      ]
    );
  }

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

  const payload = ethers.utils.solidityPack(
    ["bytes", "bytes", "bytes", "bytes", "uint256", "uint256", "uint256"],
    [
      actionPayload,
      joinSplitsPayload,
      refundAddrPayload,
      refundAssetsPayload,
      op.executionGasLimit,
      op.gasPrice,
      op.maxNumRefunds,
    ]
  );

  return ethers.utils.keccak256(payload);
}

export function calculateOperationDigest(
  operation: PreSignOperation | PreProofOperation | ProvenOperation
): bigint {
  const operationHash = hashOperation(operation);
  return BigInt(operationHash) % SNARK_SCALAR_FIELD;
}
