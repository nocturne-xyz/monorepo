import {
  MockSubtreeUpdateProver,
  SubtreeUpdateProver,
} from "@nocturne-xyz/sdk";
import { RapidsnarkSubtreeUpdateProver } from "@nocturne-xyz/subtree-updater";
import findWorkspaceRoot from "find-yarn-workspace-root";
import * as path from "path";
import * as fs from "fs";
import { WasmSubtreeUpdateProver } from "@nocturne-xyz/local-prover";

const ROOT_DIR = findWorkspaceRoot()!;
const EXECUTABLE_CMD = `${ROOT_DIR}/rapidsnark/build/prover`;
const ARTIFACTS_DIR = path.join(ROOT_DIR, "circuit-artifacts");
const WASM_PATH = `${ARTIFACTS_DIR}/subtreeupdate/subtreeupdate_js/subtreeupdate.wasm`;
const WITNESS_GEN_EXECUTABLE_PATH = `${ARTIFACTS_DIR}/subtreeupdate/subtreeupdate_cpp/subtreeupdate`;
const ZKEY_PATH = `${ARTIFACTS_DIR}/subtreeupdate/subtreeupdate_cpp/subtreeupdate.zkey`;
const TMP_PATH = `${ARTIFACTS_DIR}/subtreeupdate/`;
const VKEY_PATH = `${ARTIFACTS_DIR}/subtreeupdate/subtreeupdate_cpp/vkey.json`;

const MOCK_SUBTREE_UPDATER_DELAY = 2100;

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getSubtreeUpdateProver(): SubtreeUpdateProver {
  if (
    process.env.ACTUALLY_PROVE_SUBTREE_UPDATE === "true" &&
    process.env.USE_RAPIDSNARK === "true"
  ) {
    return new RapidsnarkSubtreeUpdateProver(
      EXECUTABLE_CMD,
      WITNESS_GEN_EXECUTABLE_PATH,
      ZKEY_PATH,
      VKEY_PATH,
      TMP_PATH
    );
  } else if (process.env.ACTUALLY_PROVE_SUBTREE_UPDATE === "true") {
    const VKEY = JSON.parse(fs.readFileSync(VKEY_PATH).toString());
    return new WasmSubtreeUpdateProver(WASM_PATH, ZKEY_PATH, VKEY);
  }

  return new MockSubtreeUpdateProver();
}

export function getSubtreeUpdaterDelay(): number {
  if (
    process.env.ACTUALLY_PROVE_SUBTREE_UPDATE === "true" &&
    process.env.USE_RAPIDSNARK === "true"
  ) {
    return MOCK_SUBTREE_UPDATER_DELAY + 8000;
  } else if (process.env.ACTUALLY_PROVE_SUBTREE_UPDATE === "true") {
    return MOCK_SUBTREE_UPDATER_DELAY + 60000;
  }

  return MOCK_SUBTREE_UPDATER_DELAY;
}
