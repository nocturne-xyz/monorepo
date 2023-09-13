import { _TypedDataEncoder } from "ethers/lib/utils";
import {
  SignableJoinSplit,
  SignableOperationWithNetworkInfo,
  computeOperationDigest,
  hashOperation,
} from "../src";
import { OPERATION_TYPES } from "../src/primitives/operation";

(async () => {
  const joinSplit: SignableJoinSplit = {
    commitmentTreeRoot: 1n,
    nullifierA: 1n,
    nullifierB: 1n,
    newNoteACommitment: 1n,
    newNoteBCommitment: 1n,
    senderCommitment: 1n,
    joinSplitInfoCommitment: 1n,
    newNoteAEncrypted: {
      ciphertextBytes: [],
      encapsulatedSecretBytes: [],
    },
    newNoteBEncrypted: {
      ciphertextBytes: [],
      encapsulatedSecretBytes: [],
    },
  };

  const pubJoinSplit = {
    joinSplit,
    assetIndex: 1,
    publicSpend: 1n,
  };

  const operation: SignableOperationWithNetworkInfo = {
    networkInfo: {
      chainId: 1n,
      tellerContract: "0x1111111111111111111111111111111111111111",
    },
    pubJoinSplits: [pubJoinSplit],
    confJoinSplits: [joinSplit],
    refundAddr: {
      h1: 1n,
      h2: 1n,
    },
    trackedAssets: [
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

  const joinSplitHash = _TypedDataEncoder.hashStruct(
    "JoinSplitWithoutProof",
    OPERATION_TYPES,
    joinSplit
  );
  console.log("joinSplitHash", joinSplitHash);

  const joinSplitsArrayHash = _TypedDataEncoder.hashStruct(
    "JoinSplitWithoutProof[]",
    OPERATION_TYPES,
    operation.confJoinSplits
  );
  console.log("joinSplitsArrayHash", joinSplitsArrayHash);

  const pubJoinSplitHash = _TypedDataEncoder.hashStruct(
    "PublicJoinSplitWithoutProof",
    OPERATION_TYPES,
    operation.pubJoinSplits[0]
  );
  console.log("pubJoinSplitHash", pubJoinSplitHash);

  const pubJoinSplitsArrayHash = _TypedDataEncoder.hashStruct(
    "PublicJoinSplitWithoutProof[]",
    OPERATION_TYPES,
    operation.pubJoinSplits
  );
  console.log("pubJoinSplitsArrayHash", pubJoinSplitsArrayHash);

  const typehash = new _TypedDataEncoder(OPERATION_TYPES)._types[
    "OperationWithoutProofs"
  ];
  console.log("typehash", typehash);
})();
