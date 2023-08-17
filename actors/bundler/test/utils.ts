const JOINSPLIT = {
  proof: ["0n", "0n", "0n", "0n", "0n", "0n", "0n", "0n"],
  senderCommitment: "0n",
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