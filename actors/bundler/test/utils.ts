import { ethers } from "ethers";

const JOINSPLIT = {
  proof: ["0n", "0n", "0n", "0n", "0n", "0n", "0n", "0n"],
  senderCommitment: "0n",
  joinSplitInfoCommitment: "0n",
  commitmentTreeRoot: "0n",
  nullifierA: "0n",
  nullifierB: "0n",
  newNoteACommitment: "0n",
  newNoteBCommitment: "0n",
  newNoteAEncrypted: {
    encapsulatedSecretBytes: [1, 2, 3, 4],
    ciphertextBytes: [1, 2, 3, 4],
  },
  newNoteBEncrypted: {
    encapsulatedSecretBytes: [1, 2, 3, 4],
    ciphertextBytes: [1, 2, 3, 4],
  },
};

export const VALID_RELAY_REQUEST = {
  operation: {
    networkInfo: {
      chainId: "123n",
      tellerContract: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
    },
    pubJoinSplits: [
      {
        joinSplit: JOINSPLIT,
        assetIndex: 1,
        publicSpend: "100n",
      },
    ],
    confJoinSplits: [JOINSPLIT],
    refundAddr: {
      h1: "0n",
      h2: "0n",
    },
    trackedAssets: [
      {
        encodedAsset: {
          encodedAssetAddr: "2n",
          encodedAssetId: "3n",
        },
        minRefundValue: "100n",
      },
    ],
    actions: [
      {
        contractAddress: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
        encodedFunction: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
      },
    ],
    encodedGasAsset: {
      encodedAssetAddr: "2n",
      encodedAssetId: "3n",
    },
    gasAssetRefundThreshold: "100n",
    executionGasLimit: "10000000n",
    gasPrice: "10n",
    deadline: "1000n",
    atomicActions: true,
  },
};

const RPC_URL = "https://eth.llamarpc.com";
export const TEST_PROVIDER = new ethers.providers.JsonRpcProvider(RPC_URL);
export const DUMMY_CONTRACT_ADDRESS = ethers.utils.getAddress(
  "0x71C7656EC7ab88b098defB751B7401B5f6d8976F"
);
export const DUMMY_ADDRESSES = [
  ethers.utils.getAddress("0xddbd1e80090943632ed47b1632cb36e7ca28abc2"),
  ethers.utils.getAddress("0x6798639591530fbbafd12c2826422b58bd2c5219"),
  ethers.utils.getAddress("0x67f8f9a5d4290325506b119980660624dc7d3ba9"),
];
