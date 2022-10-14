import findWorkspaceRoot from "find-yarn-workspace-root";
import * as path from "path";
import * as fs from "fs";
import { BinaryPoseidonTree } from "../src/primitives/binaryPoseidonTree";
import { FlaxPrivKey, FlaxSigner } from "../src/crypto/crypto";
import {
  // proveSpend2,
  // verifySpend2Proof,
  MerkleProofInput,
  NoteInput,
  FlaxAddressInput,
  Spend2Inputs,
  proveSpend2,
  verifySpend2Proof,
} from "../src/proof/spend2";
import { poseidon } from "circomlibjs";
import {
  Action,
  // Note,
  Tokens,
  UnprovenOperation,
  UnprovenSpendTransaction,
} from "../src/contract/types";
import { IERC20__factory } from "@flax/contracts";
import {
  calculateOperationDigest,
  hashOperation,
  hashSpend,
} from "../src/contract/utils";

/* Summary:
 *  - Alice = address(1), Bob = address(2)
 *  - Alice FlaxAddress seeds from sk = BigInt(1) (printed to console)
 *  - Token A = address(3)
 *  - Alice deposits 8 sets of 100 A tokens to vault
 *  - Alice is spends 100 A tokens for an operation
 *  - Operation is to transfer 50 A tokens to Bob
 */

const ROOT_DIR = findWorkspaceRoot()!;
const SPEND2_FIXTURE_PATH = path.join(ROOT_DIR, "fixtures/spend2Proof.json");
const SNARK_SCALAR_FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617;

// EXPORT - sender/receiver addrs
// const ALICE = "0x0000000000000000000000000000000000000001";
const BOB = "0x0000000000000000000000000000000000000002";

// EXPORT - token address
const TOKEN_ADDR_STR = "0x0000000000000000000000000000000000000003";
const TOKEN_ADDR_INT = 3;

const writeToFixture = process.argv[2] == "--writeFixture";

const sk = BigInt(1);

// Instantiate flax keypair and addr
const flaxPrivKey = new FlaxPrivKey(sk);
const vk = flaxPrivKey.vk;
const flaxSigner = new FlaxSigner(flaxPrivKey);
const flaxAddr = flaxSigner.address;
const spendPk = flaxSigner.privkey.spendPk();

console.log("FLAXAddress: ", flaxAddr);

// EXPORT flax address
const flaxAddrInput: FlaxAddressInput = {
  h1X: flaxAddr.h1[0],
  h1Y: flaxAddr.h1[1],
  h2X: flaxAddr.h2[0],
  h2Y: flaxAddr.h2[1],
};

// EXPORT old note, which will determine initial deposits and be put in tree
const oldNote: NoteInput = {
  owner: flaxAddrInput,
  nonce: 0n,
  type: BigInt(TOKEN_ADDR_INT),
  value: 100n,
  id: BigInt(SNARK_SCALAR_FIELD - 1),
};
console.log("OLD NOTE: ", oldNote);

const ownerHash = flaxAddr.hash();
const oldNoteCommitment = poseidon([
  ownerHash,
  0n,
  oldNote.type,
  oldNote.id,
  oldNote.value,
]);
console.log("OLD NOTE COMMITMENT: ", oldNoteCommitment);

const nullifier = poseidon([flaxSigner.privkey.vk, oldNoteCommitment]);

// EXPORT valid merkle proof
const tree = new BinaryPoseidonTree();
tree.insert(oldNoteCommitment);
console.log("MERKLE ROOT: ", tree.root());

const merkleProof = tree.createProof(0);
const merkleProofInput: MerkleProofInput = {
  path: merkleProof.pathIndices.map((n) => BigInt(n)),
  siblings: merkleProof.siblings,
};
console.log("MERKLE PROOF: ", merkleProofInput);

// New note resulting from spend of 50 units
const newNote: NoteInput = {
  owner: flaxAddrInput,
  nonce: 1n,
  type: oldNote.type,
  id: oldNote.id,
  value: 50n,
};
console.log("NEW NOTE: ", newNote);

const newNoteCommitment = poseidon([
  ownerHash,
  newNote.type,
  newNote.id,
  newNote.value,
]);
console.log("NEW NOTE COMMITMENT: ", newNoteCommitment);

// EXPORT encoded function data
const encodedFunction = IERC20__factory.createInterface().encodeFunctionData(
  "transfer",
  [BOB, 50]
);
console.log("ENCODED FUNCTION: ", encodedFunction);
const action: Action = {
  contractAddress: TOKEN_ADDR_STR,
  encodedFunction: encodedFunction,
};

// _________ Operation __________

const unprovenSpendTransaction: UnprovenSpendTransaction = {
  commitmentTreeRoot: merkleProof.root,
  nullifier: nullifier,
  newNoteCommitment: newNoteCommitment,
  asset: TOKEN_ADDR_STR,
  value: oldNote.value,
  id: BigInt(SNARK_SCALAR_FIELD - 1),
};
console.log("UNPROVEN SPEND: ", unprovenSpendTransaction);

const tokens: Tokens = {
  spendTokens: [TOKEN_ADDR_STR],
  refundTokens: [TOKEN_ADDR_STR],
};
console.log("TOKENS: ", tokens);

const unprovenOperation: UnprovenOperation = {
  refundAddr: flaxAddrInput,
  tokens: tokens,
  actions: [action],
  gasLimit: 1_000_000n,
};
console.log("UNPROVEN OPERATION: ", unprovenOperation);

// Sign operation hash
const operationHash = hashOperation(unprovenOperation);
console.log("OPERATION HASH: ", operationHash);

const spendHash = hashSpend(unprovenSpendTransaction);
console.log("SPEND HASH: ", spendHash);

const operationDigest = BigInt(
  calculateOperationDigest(operationHash, spendHash)
);
console.log("OPERATION DIGEST: ", operationDigest);

const opSig = flaxSigner.sign(operationDigest);
console.log(opSig);

const spend2Inputs: Spend2Inputs = {
  vk,
  spendPk,
  operationDigest,
  c: opSig.c,
  z: opSig.z,
  oldNote,
  newNote,
  merkleProof: merkleProofInput,
};
console.log(spend2Inputs);

(async () => {
  const proof = await proveSpend2(spend2Inputs);
  if (!(await verifySpend2Proof(proof))) {
    throw new Error("Proof invalid!");
  }
  const json = JSON.stringify(proof);
  console.log(json);

  if (writeToFixture) {
    fs.writeFileSync(SPEND2_FIXTURE_PATH, json, {
      encoding: "utf8",
      flag: "w",
    });
  }
  process.exit(0);
})();

/*
bytes memory encodedFunction = abi.encodeWithSelector(
    token.transfer.selector,
    BOB,
    100
);
IWallet.Action memory transferAction = IWallet.Action({
    contractAddress: address(token),
    encodedFunction: encodedFunction
});

uint256 root = wallet.getRoot();
IWallet.SpendTransaction memory spendTx = IWallet.SpendTransaction({
    commitmentTreeRoot: root,
    nullifier: uint256(182),
    newNoteCommitment: uint256(1038),
    proof: defaultSpendProof(),
    value: uint256(100),
    asset: address(token),
    id: ERC20_ID,
    c: uint256(0xc),
    z: uint256(0xd)
});

address[] memory spendTokens = new address[](1);
spendTokens[0] = address(token);
address[] memory refundTokens = new address[](0);
IWallet.Tokens memory tokens = IWallet.Tokens({
    spendTokens: spendTokens,
    refundTokens: refundTokens
});

IWallet.SpendTransaction[]
    memory spendTxs = new IWallet.SpendTransaction[](1);
spendTxs[0] = spendTx;
IWallet.Action[] memory actions = new IWallet.Action[](1);
actions[0] = transferAction;
IWallet.Operation memory op = IWallet.Operation({
    spendTxs: spendTxs,
    refundAddr: defaultFlaxAddress(),
    tokens: tokens,
    actions: actions,
    gasLimit: DEFAULT_GAS_LIMIT
});

IWallet.Operation[] memory ops = new IWallet.Operation[](1);
ops[0] = op;
IWallet.Bundle memory bundle = IWallet.Bundle({operations: ops});
*/
