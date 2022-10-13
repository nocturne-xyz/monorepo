// import findWorkspaceRoot from "find-yarn-workspace-root";
// import * as path from "path";
// import * as fs from "fs";
import { BinaryPoseidonTree } from "../src/primitives/binaryPoseidonTree";
import { FlaxPrivKey, FlaxSigner } from "../src/crypto/crypto";
import {
  // proveSpend2,
  // verifySpend2Proof,
  MerkleProofInput,
  NoteInput,
  FlaxAddressInput,
  Spend2Inputs,
} from "../src/proof/spend2";
import { poseidon } from "circomlibjs";
import { Note } from "../src/contract/types";
import { IERC20__factory } from "@flax/contracts";

// const ROOT_DIR = findWorkspaceRoot()!;
// const SPEND2_FIXTURE_PATH = path.join(ROOT_DIR, "fixtures/spend2Proof.json");
const SNARK_SCALAR_FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617;

const sk = BigInt(
  "0x38156abe7fe2fd433dc9df969286b96666489bac508612d0e16593e944c4f69f"
);

// Instantiate flax keypair and addr
const flaxPrivKey = new FlaxPrivKey(sk);
const vk = flaxPrivKey.vk;
const flaxSigner = new FlaxSigner(flaxPrivKey);
const flaxAddr = flaxSigner.address;
const spendPk = flaxSigner.privkey.spendPk();

// EXPORT flax address
const flaxAddrInput: FlaxAddressInput = {
  h1X: flaxAddr.h1[0],
  h1Y: flaxAddr.h1[1],
  h2X: flaxAddr.h2[0],
  h2Y: flaxAddr.h2[1],
};

// EXPORT token address
const tokenAddr = 1;

// EXPORT old note, which will determine initial deposits and be put in tree
const contractOldNote: Note = {
  owner: flaxAddr,
  nonce: 1n,
  type: BigInt(tokenAddr),
  value: 10n,
  id: BigInt(SNARK_SCALAR_FIELD - 1),
};
console.log("CONTRACT OLD NOTE: ", contractOldNote);

// Old note input to spend
const oldNote: NoteInput = {
  owner: flaxAddrInput,
  nonce: 0n,
  type: BigInt(tokenAddr),
  value: 10n,
  id: BigInt(SNARK_SCALAR_FIELD - 1),
};
console.log("OLD NOTE: ", oldNote);

const ownerHash = flaxAddr.hash();
const oldNoteCommitment = poseidon([
  ownerHash,
  oldNote.type,
  oldNote.id,
  oldNote.value,
]);
console.log("OLD NOTE COMMITMENT: ", oldNoteCommitment);

// EXPORT encoded function data
const contractEncodedFunction =
  IERC20__factory.createInterface().encodeFunctionData("transfer", [
    "0x0000000000000000000000000000000000000001",
    100,
  ]);
console.log("ENCODED FUNCTION: ", contractEncodedFunction);

// Generate valid merkle proof
const tree = new BinaryPoseidonTree();
tree.insert(oldNoteCommitment);
console.log("MERKLE ROOT: ", tree.root());

const merkleProof = tree.createProof(tree.count - 1);
const merkleProofInput: MerkleProofInput = {
  path: merkleProof.pathIndices.map((n) => BigInt(n)),
  siblings: merkleProof.siblings,
};
console.log(merkleProofInput);

// New note resulting from spend of 50 units
const newNote: NoteInput = {
  owner: flaxAddrInput,
  nonce: 2n,
  type: 10n,
  value: 50n,
  id: 5n,
};
console.log("NEW NOTE: ", newNote);

const newNoteCommitment = poseidon([
  ownerHash,
  newNote.type,
  newNote.id,
  newNote.value,
]);
console.log("NEW NOTE COMMITMENT: ", newNoteCommitment);

// Sign operation hash
const operationDigest = BigInt(12345);
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

// (async () => {
//   const proof = await proveSpend2(spend2Inputs);
//   if (!(await verifySpend2Proof(proof))) {
//     throw new Error("Proof invalid!");
//   }
//   const json = JSON.stringify(proof);
//   console.log(json);

//   fs.writeFileSync(SPEND2_FIXTURE_PATH, json, {
//     encoding: "utf8",
//     flag: "w",
//   });
//   process.exit(0);
// })();

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
