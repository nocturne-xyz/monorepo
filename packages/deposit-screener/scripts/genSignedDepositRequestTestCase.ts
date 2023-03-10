import { TypedDataSigner, Signer } from "@ethersproject/abstract-signer";
import { AssetTrait, AssetType, DepositRequest } from "@nocturne-xyz/sdk";
import { ERC20_ID } from "@nocturne-xyz/sdk/dist/src/primitives/asset";
import { Wallet } from "ethers";
import { signDepositRequest } from "../src";
import * as JSON from "bigint-json-serialization";
import findWorkspaceRoot from "find-yarn-workspace-root";
import * as path from "path";
import * as fs from "fs";
import {
  DEPOSIT_CHECKER_CONTRACT_NAME,
  DEPOSIT_CHECKER_CONTRACT_VERSION,
} from "../src/typedData";

const ROOT_DIR = findWorkspaceRoot()!;
const SIGNED_DEPOSIT_REQ_FIXTURE_PATH = path.join(
  ROOT_DIR,
  "fixtures/signedDepositRequest.json"
);

const writeToFixture = process.argv[2] == "--writeFixture";

(async () => {
  const depositCheckerAddress = "0x1111111111111111111111111111111111111111";
  const signer: Signer & TypedDataSigner = new Wallet(
    "0x0000000000000000000000000000000000000000000000000000000000000001"
  );
  const depositRequest: DepositRequest = {
    chainId: 123n,
    spender: await signer.getAddress(),
    encodedAsset: AssetTrait.encode({
      assetType: AssetType.ERC20,
      assetAddr: "0x0000000000000000000000000000000000000123",
      id: ERC20_ID,
    }),
    value: 1000n,
    depositAddr: {
      h1X: 1n,
      h1Y: 2n,
      h2X: 3n,
      h2Y: 4n,
    },
    nonce: 0n,
    gasPrice: 50n,
  };

  const signedDepositRequest = await signDepositRequest(
    signer,
    depositRequest,
    depositCheckerAddress
  );

  const json = JSON.stringify({
    depositCheckerContractName: DEPOSIT_CHECKER_CONTRACT_NAME,
    depositCheckerContractVersion: DEPOSIT_CHECKER_CONTRACT_VERSION,
    signedDepositRequest,
  });
  console.log(json);

  if (writeToFixture) {
    fs.writeFileSync(SIGNED_DEPOSIT_REQ_FIXTURE_PATH, json, {
      encoding: "utf8",
      flag: "w",
    });
  }
  process.exit(0);
})();
