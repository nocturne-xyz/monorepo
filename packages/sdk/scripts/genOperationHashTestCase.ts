import {
  BaseJoinSplit,
  BasicOperation,
  computeOperationDigest,
  hashOperation,
} from "../src";
import { ethers } from "ethers";

(async () => {
  const joinSplit: BaseJoinSplit = {
    commitmentTreeRoot: 1n,
    nullifierA: 1n,
    nullifierB: 1n,
    newNoteACommitment: 1n,
    newNoteBCommitment: 1n,
    encodedAsset: {
      encodedAssetAddr: 1n,
      encodedAssetId: 1n,
    },
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

  const operation: BasicOperation = {
    joinSplits: [joinSplit],
    refundAddr: {
      h1: 1n,
      h2: 1n,
    },
    encodedRefundAssets: [
      {
        encodedAssetAddr: 1n,
        encodedAssetId: 1n,
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
    chainId: 1n,
    deadline: 1n,
    atomicActions: true,
  };

  console.log("operation", operation);

  const opHash = hashOperation(operation);
  console.log("operation hash", opHash);

  const domain: ethers.TypedDataDomain = {
    name: "NocturneTeller",
    version: "v1",
    chainId: 123,
    verifyingContract: "0x1111111111111111111111111111111111111111",
  };
  const opDigest = computeOperationDigest(domain, operation);
  console.log("operation digest", opDigest.toString(16));
})();
