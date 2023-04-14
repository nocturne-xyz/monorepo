export const VALID_PROVEN_OPERATION_OBJ = {
  joinSplits: [
    {
      proof: ["0n", "0n", "0n", "0n", "0n", "0n", "0n", "0n"],
      commitmentTreeRoot: "0n",
      nullifierA: "0n",
      nullifierB: "0n",
      newNoteACommitment: "0n",
      newNoteBCommitment: "0n",
      encodedAsset: {
        encodedAssetAddr: "1n",
        encodedAssetId: "0n",
      },
      publicSpend: "0n",
      newNoteAEncrypted: {
        owner: {
          h1X: "0n",
          h1Y: "0n",
          h2X: "0n",
          h2Y: "0n",
        },
        encappedKey: "0n",
        encryptedNonce: "0n",
        encryptedValue: "0n",
      },
      newNoteBEncrypted: {
        owner: {
          h1X: "0n",
          h1Y: "0n",
          h2X: "0n",
          h2Y: "0n",
        },
        encappedKey: "0n",
        encryptedNonce: "0n",
        encryptedValue: "0n",
      },
      encSenderCanonAddrC1X: "0n",
      encSenderCanonAddrC2X: "0n",
    },
  ],
  refundAddr: {
    h1X: "0n",
    h1Y: "0n",
    h2X: "0n",
    h2Y: "0n",
  },
  encodedRefundAssets: [
    {
      encodedAssetAddr: "2n",
      encodedAssetId: "3n",
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
  executionGasLimit: "10000000n",
  maxNumRefunds: "2n",
  gasPrice: "10n",
  chainId: "123n",
  deadline: "1000n",
  atomicActions: true,
};
