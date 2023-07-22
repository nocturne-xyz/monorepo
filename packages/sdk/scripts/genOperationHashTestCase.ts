import { _TypedDataEncoder } from "ethers/lib/utils";
import {
  SignableJoinSplit,
  SignableOperationWithNetworkInfo,
  computeOperationDigest,
  hashOperation,
} from "../src";

(async () => {
  const joinSplit: SignableJoinSplit = {
    commitmentTreeRoot: 1n,
    nullifierA: 1n,
    nullifierB: 1n,
    newNoteACommitment: 1n,
    newNoteBCommitment: 1n,
    assetIndex: 1,
    publicSpend: 1n,
    senderCommitment: 1n,
    newNoteAEncrypted: {
      ciphertextBytes: [],
      encapsulatedSecretBytes: [],
    },
    newNoteBEncrypted: {
      ciphertextBytes: [],
      encapsulatedSecretBytes: [],
    },
  };

  const operation: SignableOperationWithNetworkInfo = {
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
        minRefundValue: 1n,
      },
    ],
    trackedRefundAssets: [
      {
        encodedAsset: {
          encodedAssetAddr: 1n,
          encodedAssetId: 1n,
        },
        minRefundValue: 1n,
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
    gasPrice: 1n,
    deadline: 1n,
    atomicActions: true,
  };

  console.log("operation", operation);

  const opHash = hashOperation(operation);
  console.log("operation hash", opHash);

  const opDigest = computeOperationDigest(operation);
  console.log("operation digest", "0x" + opDigest.toString(16));
})();
