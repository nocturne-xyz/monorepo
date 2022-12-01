import "mocha";

import * as fs from "fs";
import { expect } from "chai";
import * as path from "path";
import { Note, NocturnePrivKey, NocturneSigner, BinaryPoseidonTree } from "@nocturne-xyz/sdk";
import { subtreeUpdateInputsFromBatch, applyBatchUpdateToTree } from "@nocturne-xyz/local-prover";
import { getRapidsnarkSubtreeUpdateProver } from "../src/rapidsnarkProver";
import findWorkspaceRoot from "find-yarn-workspace-root";

const SKIP = process.env.RUN_RAPIDSNARK_TESTS === "true" ? false : true;

const ROOT_DIR = findWorkspaceRoot()!;
const EXECUTABLE_CMD = "~/rapidsnark/build/prover";
const ARTIFACTS_DIR = path.join(ROOT_DIR, "circuit-artifacts");
const WITNESS_GEN_EXECUTABLE_PATH = `${ARTIFACTS_DIR}/subtreeupdate/subtreeupdate_cpp/subtreeupdate`;
const ZKEY_PATH = `${ARTIFACTS_DIR}/subtreeupdate/subtreeupdate_cpp/subtreeupdate.zkey`;
const TMP_PATH = `${ARTIFACTS_DIR}/subtreeupdate/`;
const VKEY_PATH = `${ARTIFACTS_DIR}/subtreeupdate/subtreeupdate_cpp/vkey.json`;

const prover = getRapidsnarkSubtreeUpdateProver(EXECUTABLE_CMD, WITNESS_GEN_EXECUTABLE_PATH, ZKEY_PATH, TMP_PATH);

describe('rapidsnark subtree update prover', async () =>  {
  const sk = BigInt(
  "0x38156abe7fe2fd433dc9df969286b96666489bac508612d0e16593e944c4f69f"
  );
  const flaxPrivKey = new NocturnePrivKey(sk);
  const flaxSigner = new NocturneSigner(flaxPrivKey);
  const flaxAddr = flaxSigner.address;
  const flaxAddrInput = flaxAddr.toStruct();

  let nonce = 0n;
  function dummyNote(): Note {
    return new Note({
      owner: flaxAddrInput,
      nonce: nonce++,
      asset: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      id: 5n,
      value: 100n,
    });
  }

  function dummyNoteCommitment(): bigint {
    return dummyNote().toCommitment();	
  }


  function dummyBatch(): (Note | bigint)[] {
    return [...Array(BinaryPoseidonTree.BATCH_SIZE).keys()].map(i => {
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
      const tree = new BinaryPoseidonTree();
      const batch = dummyBatch();
      
      const merkleProof = applyBatchUpdateToTree(batch, tree);
      const inputs = subtreeUpdateInputsFromBatch(batch, merkleProof);
      const proof = await prover.prove(inputs);

      const vkey = JSON.parse(fs.readFileSync(VKEY_PATH).toString());
      const verifierAccepts = await prover.verify(proof, vkey);

      expect(verifierAccepts).to.be.true;
    });
  }
});
