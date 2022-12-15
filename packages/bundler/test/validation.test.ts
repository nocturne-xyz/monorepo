import { expect } from "chai";
import { extractRelayError } from "../src/validation";

const validRelayObject = {
  joinSplitTxs: [
    {
      proof: ["0n", "0n", "0n", "0n", "0n", "0n", "0n", "0n"],
      commitmentTreeRoot: "0n",
      nullifierA: "0n",
      nullifierB: "0n",
      newNoteACommitment: "0n",
      newNoteBCommitment: "0n",
      asset: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
      id: "0n",
      publicSpend: "0n",
      newNoteATransmission: {
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
      newNoteBTransmission: {
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
    },
  ],
  refundAddr: {
    h1X: "0n",
    h1Y: "0n",
    h2X: "0n",
    h2Y: "0n",
  },
  tokens: {
    spendTokens: [
      "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
      "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
    ],
    refundTokens: [
      "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
      "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
    ],
  },
  actions: [
    {
      contractAddress: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
      encodedFunction: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
    },
  ],
  gasLimit: "10000000n",
};

describe("JSON Request Validation", async () => {
  it("Validates valid relay request", () => {
    const maybeError = extractRelayError(validRelayObject);
    console.log(maybeError);
    expect(maybeError).to.be.undefined;
  });

  it("Rejects invalid relay request", () => {
    let invalid = JSON.parse(JSON.stringify(validRelayObject));
    invalid.joinSplitTxs[0].proof[5] = "0x12345";
    invalid.asset = "0n";
    const maybeError = extractRelayError(invalid);
    expect(maybeError).to.not.be.undefined;
  });
});
