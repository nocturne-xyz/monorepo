import { AssetTrait, AssetType, DepositRequest } from "@nocturne-xyz/sdk";
import { ERC20_ID } from "@nocturne-xyz/sdk/dist/src/primitives/asset";
import { ethers, Wallet } from "ethers";
import { signDepositRequest } from "../src";
import findWorkspaceRoot from "find-yarn-workspace-root";
import * as path from "path";
import * as fs from "fs";
import {
  DEPOSIT_CHECKER_CONTRACT_NAME,
  DEPOSIT_CHECKER_CONTRACT_VERSION,
  DEPOSIT_REQUEST_TYPES,
  EIP712Domain,
} from "../src/typedData";

const ROOT_DIR = findWorkspaceRoot()!;
const SIGNED_DEPOSIT_REQ_FIXTURE_PATH = path.join(
  ROOT_DIR,
  "fixtures/signedDepositRequest.json"
);

const writeToFixture = process.argv[2] == "--writeFixture";

function toObject(obj: any) {
  return JSON.parse(
    JSON.stringify(obj, (key, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );
}

(async () => {
  const signer = new Wallet(
    "0x0000000000000000000000000000000000000000000000000000000000000001"
  );

  const depositManagerAddress = "0x1111111111111111111111111111111111111111";
  const chainId = 123n;
  const domain: EIP712Domain = {
    name: DEPOSIT_CHECKER_CONTRACT_NAME,
    version: DEPOSIT_CHECKER_CONTRACT_VERSION,
    chainId,
    verifyingContract: depositManagerAddress,
  };

  const encodedAsset = AssetTrait.encode({
    assetType: AssetType.ERC20,
    assetAddr: "0x0000000000000000000000000000000000000123",
    id: ERC20_ID,
  });

  const depositRequest: DepositRequest = {
    chainId,
    spender: await signer.getAddress(),
    encodedAssetAddr: encodedAsset.encodedAssetAddr,
    encodedAssetId: encodedAsset.encodedAssetId,
    value: 1000n,
    h1X: 1n,
    h1Y: 2n,
    h2X: 3n,
    h2Y: 5n,
    nonce: 0n,
    gasPrice: 50n,
  };

  const signature = await signDepositRequest(signer, domain, depositRequest);
  const { r, s, v } = ethers.utils.splitSignature(signature);

  const expectedSignerAddress = await signer.getAddress();
  const recoveredAddress = ethers.utils.verifyTypedData(
    domain,
    DEPOSIT_REQUEST_TYPES,
    depositRequest,
    signature
  );
  console.log("Recovered:", recoveredAddress);
  console.log("Actual:", expectedSignerAddress);

  const json = JSON.stringify(
    toObject({
      contractAddress: depositManagerAddress,
      contractName: DEPOSIT_CHECKER_CONTRACT_NAME,
      contractVersion: DEPOSIT_CHECKER_CONTRACT_VERSION,
      screenerAddress: await signer.getAddress(),
      depositRequest,
      signature: { r, s, v },
    })
  );
  console.log(json);

  if (writeToFixture) {
    fs.writeFileSync(SIGNED_DEPOSIT_REQ_FIXTURE_PATH, json, {
      encoding: "utf8",
      flag: "w",
    });
  }
  process.exit(0);
})();
