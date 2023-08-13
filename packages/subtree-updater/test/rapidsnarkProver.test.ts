import "mocha";

import { expect } from "chai";
import * as path from "path";
import {
  Note,
  NocturneSigner,
  BinaryPoseidonTree,
  NoteTrait,
  AssetType,
  subtreeUpdateInputsFromBatch,
  range,
} from "@nocturne-xyz/core";
import { RapidsnarkSubtreeUpdateProver } from "../src/rapidsnarkProver";
import findWorkspaceRoot from "find-yarn-workspace-root";

const SKIP = process.env.USE_RAPIDSNARK !== "true";

const ROOT_DIR = findWorkspaceRoot()!;
const EXECUTABLE_CMD = `${ROOT_DIR}/rapidsnark/build/prover`;
const ARTIFACTS_DIR = path.join(ROOT_DIR, "circuit-artifacts");
const WITNESS_GEN_EXECUTABLE_PATH = `${ARTIFACTS_DIR}/subtreeupdate/subtreeupdate_cpp/subtreeupdate`;
const ZKEY_PATH = `${ARTIFACTS_DIR}/subtreeupdate/subtreeupdate_cpp/subtreeupdate.zkey`;
const TMP_PATH = `${ARTIFACTS_DIR}/subtreeupdate/`;
const VKEY_PATH = `${ARTIFACTS_DIR}/subtreeupdate/subtreeupdate_cpp/vkey.json`;

describe("rapidsnark subtree update prover", async () => {
  const sk = Uint8Array.from(range(32));
  const nocturneSigner = new NocturneSigner(sk);
  const stealthAddr = nocturneSigner.generateRandomStealthAddress();

  let nonce = 0n;
  function dummyNote(): Note {
    return {
      owner: stealthAddr,
      nonce: nonce++,
      asset: {
        assetType: AssetType.ERC20,
        assetAddr: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        id: 5n,
      },
      value: 100n,
    };
  }

  function dummyNoteCommitment(): bigint {
    return NoteTrait.toCommitment(dummyNote());
  }

  function dummyBatch(): (Note | bigint)[] {
    return [...Array(BinaryPoseidonTree.BATCH_SIZE).keys()].map((i) => {
      if (i % 2 == 0) {
        return dummyNote();
      } else {
        return dummyNoteCommitment();
      }
    });
  }

  if (SKIP) {
    console.log("skipping rapidsnark tests...");
  } else {
    it("generates proofs for valid input", async () => {
      const prover = new RapidsnarkSubtreeUpdateProver(
        EXECUTABLE_CMD,
        WITNESS_GEN_EXECUTABLE_PATH,
        ZKEY_PATH,
        VKEY_PATH,
        TMP_PATH
      );
      const tree = new BinaryPoseidonTree();
      const batch = dummyBatch();

      for (let i = 0; i < batch.length; i++) {
        const item = batch[i];
        if (typeof item === "bigint") {
          tree.insert(item);
        } else {
          tree.insert(NoteTrait.toCommitment(item));
        }
      }

      const merkleProof = tree.getProof(tree.count - batch.length);
      const inputs = subtreeUpdateInputsFromBatch(batch, merkleProof);
      const proof = await prover.proveSubtreeUpdate(inputs);

      const verifierAccepts = await prover.verifySubtreeUpdate(proof);

      expect(verifierAccepts).to.be.true;
    });
  }
});
