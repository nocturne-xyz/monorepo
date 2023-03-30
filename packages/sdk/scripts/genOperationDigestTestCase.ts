import { computeOperationDigest, Operation } from "../src";
import findWorkspaceRoot from "find-yarn-workspace-root";
import * as BigIntJSON from "bigint-json-serialization";
import * as path from "path";
import * as fs from "fs";

const ROOT_DIR = findWorkspaceRoot()!;
const FIXTURE_PATH = path.join(ROOT_DIR, "fixtures/operationDigest.json");

const writeToFixture = process.argv[2] == "--writeFixture";

function toObject(obj: any) {
  return JSON.parse(
    JSON.stringify(obj, (key, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );
}

const operation: Operation = BigIntJSON.parse(
  BigIntJSON.stringify({
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
  })
);

const digest = computeOperationDigest(operation);
const json = JSON.stringify({
  operation: toObject(operation),
  digest: digest.toString(),
});

console.log(json);
if (writeToFixture) {
  fs.writeFileSync(FIXTURE_PATH, json, {
    encoding: "utf8",
    flag: "w",
  });
}
