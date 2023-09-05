import findWorkspaceRoot from "find-yarn-workspace-root";
import * as path from "path";
import * as fs from "fs";
import * as JSON from "bigint-json-serialization";
import { WasmCanonAddrSigCheckProver } from "../src/canonAddrSigCheck";
import {
  CANON_ADDR_SIG_CHECK_PREFIX,
  NocturneSigner,
  range,
} from "@nocturne-xyz/core";
import { poseidonBN } from "@nocturne-xyz/crypto-utils";

const ROOT_DIR = findWorkspaceRoot()!;
const ARTIFACTS_DIR = path.join(ROOT_DIR, "circuit-artifacts");
const WASM_PATH = `${ARTIFACTS_DIR}/canonAddrSigCheck/canonAddrSigCheck_js/canonAddrSigCheck.wasm`;
const ZKEY_PATH = `${ARTIFACTS_DIR}/canonAddrSigCheck/canonAddrSigCheck_cpp/canonAddrSigCheck.zkey`;
const VKEY_PATH = `${ARTIFACTS_DIR}/canonAddrSigCheck/canonAddrSigCheck_cpp/vkey.json`;
const VKEY = JSON.parse(fs.readFileSync(VKEY_PATH).toString());
const FIXTURE_DIR = path.join(ROOT_DIR, "fixtures");

const writeToFixture = process.argv[2] == "--writeFixture";

const sk = Uint8Array.from(range(32));
const signer = new NocturneSigner(sk);

const canonAddr = signer.canonicalAddress();
const nonce = 1453n;
const msg = poseidonBN([CANON_ADDR_SIG_CHECK_PREFIX, nonce]);
const sig = signer.sign(msg);

(async () => {
  const prover = new WasmCanonAddrSigCheckProver(WASM_PATH, ZKEY_PATH, VKEY);

  const startTime = Date.now();
  const proof = await prover.proveCanonAddrSigCheck({
    canonAddr,
    nonce,
    sig,
    spendPubkey: signer.spendPk,
    vkNonce: signer.vkNonce,
  });
  console.log("Proof generated in: ", Date.now() - startTime, "ms");

  if (!(await prover.verifyCanonAddrSigCheckProof(proof))) {
    throw new Error("proof invalid!");
  }
  const json = JSON.stringify(proof);
  console.log(json);

  if (writeToFixture) {
    fs.writeFileSync(
      path.join(FIXTURE_DIR, "canonAddrSigCheckProof.json"),
      json,
      {
        encoding: "utf8",
        flag: "w",
      }
    );
  }

  process.exit(0);
})();
