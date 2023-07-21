import { _TypedDataEncoder } from "ethers/lib/utils";
import {
  OnChainProvenJoinSplit,
  OnchainOperationWithNetworkInfo,
  computeOperationDigest,
  hashOperation,
} from "../src";
import { OPERATION_TYPES } from "../src/primitives/operationDigest";

(async () => {
  const joinSplit: OnChainProvenJoinSplit = {
    commitmentTreeRoot: 1n,
    nullifierA: 1n,
    nullifierB: 1n,
    newNoteACommitment: 1n,
    newNoteBCommitment: 1n,
    assetIndex: 1,
    publicSpend: 1n,
    senderCommitment: 1n,
    proof: [0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n],
    newNoteAEncrypted: {
      ciphertextBytes: [],
      encapsulatedSecretBytes: [],
    },
    newNoteBEncrypted: {
      ciphertextBytes: [],
      encapsulatedSecretBytes: [],
    },
  };

  const operation: OnchainOperationWithNetworkInfo = {
    networkInfo: {
      chainId: 1n,
      tellerContract: "0x1111111111111111111111111111111111111111",
    },
    joinSplits: [joinSplit],
    refundAddr: {
      h1: 1n,
      h2: 1n,
    },
    trackedJoinSplitAssets: [
      {
        encodedAsset: {
          encodedAssetAddr: 1n,
          encodedAssetId: 1n,
        },
        minReturnValue: 1n,
      },
    ],
    trackedRefundAssets: [
      {
        encodedAsset: {
          encodedAssetAddr: 1n,
          encodedAssetId: 1n,
        },
        minReturnValue: 1n,
      },
    ],
    actions: [
      {
        contractAddress: "0x690B9A9E9aa1C9dB991C7721a92d351Db4FaC990",
        encodedFunction: "0x1234",
      },
    ],
    encodedGasAsset: {
      encodedAssetAddr: 1n,
      encodedAssetId: 1n,
    },
    gasAssetRefundThreshold: 1n,
    executionGasLimit: 1n,
    maxNumRefunds: 1n,
    gasPrice: 1n,
    deadline: 1n,
    atomicActions: true,
  };

  console.log("operation", operation);

  const opHash = hashOperation(operation);
  console.log("operation hash", opHash);

  const opDigest = computeOperationDigest(operation);
  console.log("operation digest", "0x" + opDigest.toString(16));

  const hashedTrackedAsset = _TypedDataEncoder.hashStruct(
    "TrackedAsset",
    OPERATION_TYPES,
    operation.trackedJoinSplitAssets[0]
  );
  console.log("hashed tracked joinsplit asset", hashedTrackedAsset);

  const hashedAsset = _TypedDataEncoder.hashStruct(
    "EncodedAsset",
    OPERATION_TYPES,
    operation.trackedJoinSplitAssets[0].encodedAsset
  );
  console.log("hashed encoded asset", hashedAsset);

  const hashedJoinSplit = _TypedDataEncoder.hashStruct(
    "JoinSplitWithoutProof",
    OPERATION_TYPES,
    joinSplit
  );
  console.log("hashed joinsplit", hashedJoinSplit);
})();
