import findWorkspaceRoot from "find-yarn-workspace-root";
import * as path from "path";
import * as fs from "fs";
import * as JSON from "bigint-json-serialization";
import { poseidonBN } from "@nocturne-xyz/crypto-utils";
import { WasmJoinSplitProver } from "../src/joinsplit";
import { IncrementalMerkleTree } from "@zk-kit/incremental-merkle-tree";
import {
  NocturneSigner,
  JoinSplitInputs,
  MerkleProofInput,
  EncodedNote,
  StealthAddressTrait,
  encodeEncodedAssetAddrWithSignBitsPI,
  TreeConstants,
  EncodedAsset,
  JoinSplitProver,
  range,
} from "@nocturne-xyz/sdk";

const { ZERO_VALUE, ARITY, DEPTH } = TreeConstants;

const ROOT_DIR = findWorkspaceRoot()!;
const ARTIFACTS_DIR = path.join(ROOT_DIR, "circuit-artifacts");
const WASM_PATH = `${ARTIFACTS_DIR}/joinsplit/joinsplit_js/joinsplit.wasm`;
const ZKEY_PATH = `${ARTIFACTS_DIR}/joinsplit/joinsplit_cpp/joinsplit.zkey`;
const VKEY_PATH = `${ARTIFACTS_DIR}/joinsplit/joinsplit_cpp/vkey.json`;
const VKEY = JSON.parse(fs.readFileSync(VKEY_PATH).toString());
const JOINSPLIT_FIXTURE_DIR = path.join(ROOT_DIR, "fixtures");

const writeToFixture = process.argv[2] == "--writeFixture";

const sk = Uint8Array.from(range(32));

// Instantiate nocturne keypair and addr
const nocturneSigner = new NocturneSigner(sk);
const vk = nocturneSigner.vk;
const spendPk = nocturneSigner.spendPk;

interface JoinSplitValues {
  oldNoteAValue: bigint;
  oldNoteBValue: bigint;
  newNoteAValue: bigint;
  newNoteBValue: bigint;
}

function makeTestJoinSplitInputs(
  asset: EncodedAsset,
  {
    oldNoteAValue,
    oldNoteBValue,
    newNoteAValue,
    newNoteBValue,
  }: JoinSplitValues
): JoinSplitInputs {
  const stealthAddrA = nocturneSigner.canonicalStealthAddress();
  const stealthAddrB = nocturneSigner.canonicalStealthAddress();

  const refundAddr = StealthAddressTrait.compress(
    nocturneSigner.generateRandomStealthAddress()
  );

  const { encodedAssetAddr, encodedAssetId } = asset;

  const oldNoteA: EncodedNote = {
    owner: stealthAddrA,
    nonce: 1n,
    encodedAssetAddr,
    encodedAssetId,
    value: oldNoteAValue,
  };
  console.log("old note A: ", oldNoteA);

  const oldNoteAOwnerHash = StealthAddressTrait.hash(stealthAddrA);
  const oldNoteACommitment = poseidonBN([
    oldNoteAOwnerHash,
    oldNoteA.nonce,
    oldNoteA.encodedAssetAddr,
    oldNoteA.encodedAssetId,
    oldNoteA.value,
  ]);
  console.log("old note commitment A: ", oldNoteACommitment);

  const oldNoteB: EncodedNote = {
    owner: stealthAddrB,
    nonce: 2n,
    encodedAssetAddr,
    encodedAssetId,
    value: oldNoteBValue,
  };
  console.log("old note B: ", oldNoteB);

  const oldNoteBOwnerHash = StealthAddressTrait.hash(stealthAddrB);
  const oldNoteBCommitment = poseidonBN([
    oldNoteBOwnerHash,
    oldNoteB.nonce,
    oldNoteB.encodedAssetAddr,
    oldNoteB.encodedAssetId,
    oldNoteB.value,
  ]);
  console.log("old note commitment B: ", oldNoteBCommitment);

  // Generate valid merkle proofs
  const tree = new IncrementalMerkleTree(poseidonBN, DEPTH, ZERO_VALUE, ARITY);
  tree.insert(oldNoteACommitment);
  tree.insert(oldNoteBCommitment);

  const merkleProofA = tree.createProof(0);
  const merkleProofB = tree.createProof(1);

  console.log("merkle root A: ", merkleProofA.root);
  console.log("merkle root B: ", merkleProofB.root);

  const merkleProofAInput: MerkleProofInput = {
    path: merkleProofA.pathIndices.map((n) => BigInt(n)),
    siblings: merkleProofA.siblings,
  };
  const merkleProofBInput: MerkleProofInput = {
    path: merkleProofB.pathIndices.map((n) => BigInt(n)),
    siblings: merkleProofB.siblings,
  };

  const newNoteA: EncodedNote = {
    owner: stealthAddrA,
    nonce: 3n,
    encodedAssetAddr,
    encodedAssetId,
    value: newNoteAValue,
  };
  console.log("new note A: ", newNoteA);

  const newNoteB: EncodedNote = {
    owner: stealthAddrB,
    nonce: 4n,
    encodedAssetAddr,
    encodedAssetId,
    value: newNoteBValue,
  };
  console.log("new note B: ", newNoteB);

  const newNoteACommitment = poseidonBN([
    oldNoteAOwnerHash,
    newNoteA.nonce,
    newNoteA.encodedAssetAddr,
    newNoteA.encodedAssetId,
    newNoteA.value,
  ]);
  console.log("new note commitment A: ", newNoteACommitment);

  const newNoteBCommitment = poseidonBN([
    oldNoteBOwnerHash,
    newNoteB.nonce,
    newNoteB.encodedAssetAddr,
    newNoteB.encodedAssetId,
    newNoteB.value,
  ]);
  console.log("new note commitment B: ", newNoteBCommitment);

  // Sign operation hash
  const operationDigest = BigInt(12345);
  const opSig = nocturneSigner.sign(operationDigest);
  console.log(opSig);

  const publicSpend =
    oldNoteA.value + oldNoteB.value - (newNoteA.value + newNoteB.value);
  console.log("public spend");

  const pubEncodedAssetAddrWithSignBits = encodeEncodedAssetAddrWithSignBitsPI(
    publicSpend === 0n ? 0n : oldNoteA.encodedAssetAddr,
    refundAddr
  );
  const pubEncodedAssetId = publicSpend === 0n ? 0n : oldNoteA.encodedAssetId;

  const joinsplitInputs: JoinSplitInputs = {
    vk,
    vkNonce: nocturneSigner.vkNonce,
    spendPk: [spendPk.x, spendPk.y],
    operationDigest,
    c: opSig.c,
    z: opSig.z,
    oldNoteA,
    oldNoteB,
    newNoteA,
    newNoteB,
    merkleProofA: merkleProofAInput,
    merkleProofB: merkleProofBInput,
    refundAddr,

    pubEncodedAssetAddrWithSignBits,
    pubEncodedAssetId,
  };
  console.log(joinsplitInputs);

  return joinsplitInputs;
}

function makeGenerateProofFn(
  prover: JoinSplitProver
): (inputs: JoinSplitInputs, filename: string) => Promise<void> {
  return async (inputs: JoinSplitInputs, filename: string): Promise<void> => {
    const startTime = Date.now();
    const proof = await prover.proveJoinSplit(inputs);
    console.log("Proof generated in: ", Date.now() - startTime, "ms");

    if (!(await prover.verifyJoinSplitProof(proof))) {
      throw new Error("proof invalid!");
    }
    const json = JSON.stringify(proof);
    console.log(json);

    if (writeToFixture) {
      fs.writeFileSync(filename, json, {
        encoding: "utf8",
        flag: "w",
      });
    }
  };
}

(async () => {
  const prover = new WasmJoinSplitProver(WASM_PATH, ZKEY_PATH, VKEY);
  const generateProof = makeGenerateProofFn(prover);

  const asset: EncodedAsset = {
    encodedAssetAddr: 10n,
    encodedAssetId: 5n,
  };

  // generate proof with 0 publicSpend
  {
    const inputs = makeTestJoinSplitInputs(asset, {
      oldNoteAValue: 100n,
      oldNoteBValue: 200n,
      newNoteAValue: 50n,
      newNoteBValue: 250n,
    });
    const filename = path.join(
      JOINSPLIT_FIXTURE_DIR,
      "joinsplit_0_publicSpend.json"
    );
    await generateProof(inputs, filename);
  }

  // generate proof with 100 publicSpend
  {
    const inputs = makeTestJoinSplitInputs(asset, {
      oldNoteAValue: 100n,
      oldNoteBValue: 200n,
      newNoteAValue: 50n,
      newNoteBValue: 150n,
    });
    const filename = path.join(
      JOINSPLIT_FIXTURE_DIR,
      "joinsplit_100_publicSpend.json"
    );
    await generateProof(inputs, filename);
  }

  process.exit(0);
})();
