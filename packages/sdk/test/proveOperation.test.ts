import "mocha";
import { expect } from "chai";
import { getDummyHex, setup, shitcoin } from "./utils";
import { NocturnePrivKey } from "../src/crypto";
import { OperationRequestBuilder } from "../src/sdk";
import { prepareOperation } from "../src/sdk/prepareOperation";
import { proveOperation } from "../src/sdk/proveOperation";
import { WasmJoinSplitProver } from "@nocturne-xyz/local-prover";

import findWorkspaceRoot from "find-yarn-workspace-root";
import * as path from "path";
import * as fs from "fs";

const ROOT_DIR = findWorkspaceRoot()!;
const ARTIFACTS_DIR = path.join(ROOT_DIR, "circuit-artifacts");
const WASM_PATH = `${ARTIFACTS_DIR}/joinsplit/joinsplit_js/joinsplit.wasm`;
const ZKEY_PATH = `${ARTIFACTS_DIR}/joinsplit/joinsplit_cpp/joinsplit.zkey`;
const VKEY_PATH = `${ARTIFACTS_DIR}/joinsplit/joinsplit_cpp/vkey.json`;
const VKEY = JSON.parse(fs.readFileSync(VKEY_PATH).toString());

describe("proveOperation", () => {
  it("proves an operation with 1 action, 1 unwrap, 1 payment", async () => {
    const prover = new WasmJoinSplitProver(WASM_PATH, ZKEY_PATH, VKEY);
    const [notesDB, merkleProver, signer, walletContract] = await setup(
      [100n, 10n],
      [shitcoin, shitcoin],
      {
        mockMerkle: false
      }
    );
    const receiverPriv = NocturnePrivKey.genPriv();
    const receiver = receiverPriv.toCanonAddress();

    // make operation request, prepare it, and sign it
    const builder = new OperationRequestBuilder();
    const request = builder
      .action("0x1234", getDummyHex(0))
      .unwrap(shitcoin, 3n)
      .refundAsset(shitcoin)
      .confidentialPayment(shitcoin, 1n, receiver)
      .gas({
        verificationGasLimit: 1_000_000n,
        executionGasLimit: 1_000_000n,
        gasPrice: 1n,
      })
      .build();
    const preSign = await prepareOperation(
      request,
      notesDB,
      merkleProver,
      signer,
      walletContract
    );
    const preProof = signer.signOperation(preSign);

    // attempt to prove it
    // expect it to not fail, and to have a valid proof
    const proven = await proveOperation(preProof, prover);
    expect(proven).to.not.be.undefined;
    expect(proven).to.not.be.null;
  })
})