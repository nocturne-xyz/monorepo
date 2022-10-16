import { resetHardhatContext } from "hardhat/plugins-testing";
import { expect } from "chai";
import { ethers, deployments, getNamedAccounts } from "hardhat";
import {
  Wallet__factory,
  Vault__factory,
  Spend2Verifier__factory,
  PoseidonBatchBinaryMerkle__factory,
  PoseidonHasherT3__factory,
  PoseidonHasherT5__factory,
  PoseidonHasherT6__factory,
  SimpleERC20Token__factory,
  Vault,
  Wallet,
} from "@flax/contracts";
import { SimpleERC20Token } from "@flax/contracts/dist/src/SimpleERC20Token";

import findWorkspaceRoot from "find-yarn-workspace-root";
import * as path from "path";
import * as fs from "fs";
import {
  BinaryPoseidonTree,
  FlaxPrivKey,
  FlaxSigner,
  Action,
  proveSpend2,
  verifySpend2Proof,
  MerkleProofInput,
  NoteInput,
  UnprovenSpendTransaction,
  Spend2Inputs,
  SNARK_SCALAR_FIELD,
  Tokens,
  UnprovenOperation,
  hashOperation,
  hashSpend,
  calculateOperationDigest,
  packToSolidityProof,
  ProvenSpendTransaction,
  ProvenOperation,
  Bundle,
} from "@flax/sdk";

import { poseidon } from "circomlibjs";
const circomlibjs = require("circomlibjs");
const poseidonContract = circomlibjs.poseidon_gencontract;

const ERC20_ID = SNARK_SCALAR_FIELD - 1n;
const PER_SPEND_AMOUNT = 100n;

describe("Wallet", async () => {
  let deployer: ethers.Signer, alice: ethers.Signer, bob: ethers.Signer;
  let vault: Vault, wallet: Wallet, token: SimpleERC20Token;
  let flaxSigner: FlaxSigner;

  async function setup() {
    const sk = BigInt(1);
    const flaxPrivKey = new FlaxPrivKey(sk);
    const vk = flaxPrivKey.vk;
    flaxSigner = new FlaxSigner(flaxPrivKey);

    [deployer, alice, bob] = await ethers.getSigners();
    await deployments.fixture(["PoseidonLibs", "BatchBinaryMerkleLib"]);

    const poseidonT3Lib = await ethers.getContract("PoseidonT3Lib");
    const poseidonT5Lib = await ethers.getContract("PoseidonT5Lib");
    const poseidonT6Lib = await ethers.getContract("PoseidonT6Lib");

    const poseidonT3Factory = new PoseidonHasherT3__factory(deployer);
    const poseidonHasherT3 = await poseidonT3Factory.deploy(
      poseidonT3Lib.address
    );

    const poseidonT5Factory = new PoseidonHasherT5__factory(deployer);
    const poseidonHasherT5 = await poseidonT5Factory.deploy(
      poseidonT5Lib.address
    );

    const poseidonT6Factory = new PoseidonHasherT6__factory(deployer);
    const poseidonHasherT6 = await poseidonT6Factory.deploy(
      poseidonT6Lib.address
    );

    const tokenFactory = new SimpleERC20Token__factory(deployer);
    token = await tokenFactory.deploy();

    const vaultFactory = new Vault__factory(deployer);
    vault = await vaultFactory.deploy();

    const verifierFactory = new Spend2Verifier__factory(deployer);
    const verifier = await verifierFactory.deploy();

    const merkleFactory = new PoseidonBatchBinaryMerkle__factory(deployer);
    const merkle = await merkleFactory.deploy(32, 0, poseidonT3Lib.address);

    const walletFactory = new Wallet__factory(deployer);
    wallet = await walletFactory.deploy(
      vault.address,
      verifier.address,
      merkle.address,
      poseidonHasherT5.address,
      poseidonHasherT6.address
    );

    await vault.initialize(wallet.address);
  }

  async function aliceDepositFunds() {
    token.reserveTokens(alice.address, 1000);
    await token.connect(alice).approve(vault.address, 200);

    for (let i = 0; i < 2; i++) {
      await wallet.connect(alice).depositFunds({
        spender: alice.address as string,
        asset: token.address,
        value: PER_SPEND_AMOUNT,
        id: ERC20_ID,
        depositAddr: flaxSigner.address.toFlattened(),
      });
    }
  }

  beforeEach(async () => {
    await setup();
  });

  it("Test", async () => {
    // Deposit funds and commit note commitments
    await aliceDepositFunds();
    await wallet.commit2FromQueue();

    // Create two corresponding notes from deposits
    const firstOldNote: NoteInput = {
      owner: flaxSigner.address.toFlattened(),
      nonce: 0n,
      type: BigInt(token.address),
      value: PER_SPEND_AMOUNT,
      id: SNARK_SCALAR_FIELD - 1n,
    };
    const secondOldNote: NoteInput = {
      owner: flaxSigner.address.toFlattened(),
      nonce: 1n,
      type: BigInt(token.address),
      value: PER_SPEND_AMOUNT,
      id: SNARK_SCALAR_FIELD - 1n,
    };

    // Create corresponding note commitments
    const ownerHash = flaxSigner.address.hash();
    const firstOldNoteCommitment = poseidon([
      ownerHash,
      firstOldNote.nonce,
      firstOldNote.type,
      firstOldNote.id,
      firstOldNote.value,
    ]);
    const secondOldNoteCommitment = poseidon([
      ownerHash,
      secondOldNote.nonce,
      secondOldNote.type,
      secondOldNote.id,
      secondOldNote.value,
    ]);

    // Create nullifier for first note
    const nullifier = poseidon([flaxSigner.privkey.vk, firstOldNoteCommitment]);

    // Replicate commitment tree state
    const tree = new BinaryPoseidonTree();
    tree.insert(firstOldNoteCommitment);
    tree.insert(secondOldNoteCommitment);

    // Generate proof for first note commitment
    expect(tree.root()).to.equal((await wallet.getRoot()).toBigInt());
    const merkleProof = tree.createProof(0);
    const merkleProofInput: MerkleProofInput = {
      path: merkleProof.pathIndices.map((n) => BigInt(n)),
      siblings: merkleProof.siblings,
    };

    // New note and note commitment resulting from spend of 100 units
    const newNote: NoteInput = {
      owner: flaxSigner.address.toFlattened(),
      nonce: 12345n,
      type: firstOldNote.type,
      id: firstOldNote.id,
      value: 100n,
    };
    const newNoteCommitment = poseidon([
      ownerHash,
      newNote.type,
      newNote.id,
      newNote.value,
    ]);

    // Create Action to transfer the 100 tokens to bob
    const encodedFunction =
      SimpleERC20Token__factory.createInterface().encodeFunctionData(
        "transfer",
        [bob.address, 100]
      );
    const action: Action = {
      contractAddress: token.address,
      encodedFunction: encodedFunction,
    };

    // Create unproven spend
    const unprovenSpendTx: UnprovenSpendTransaction = {
      commitmentTreeRoot: merkleProof.root,
      nullifier: nullifier,
      newNoteCommitment: newNoteCommitment,
      asset: token.address,
      value: firstOldNote.value,
      id: SNARK_SCALAR_FIELD - 1n,
    };

    // Create unproven operation
    const tokens: Tokens = {
      spendTokens: [token.address],
      refundTokens: [],
    };
    const unprovenOperation: UnprovenOperation = {
      refundAddr: flaxSigner.address.toFlattened(),
      tokens: tokens,
      actions: [action],
      gasLimit: 1_000_000n,
    };

    // Calculate operation digest (combo of spend and operation)
    const operationHash = hashOperation(unprovenOperation);
    const spendHash = hashSpend(unprovenSpendTx);
    const operationDigest = BigInt(
      calculateOperationDigest(operationHash, spendHash)
    );

    // Sign operation digest
    const opSig = flaxSigner.sign(operationDigest);

    // Format prover inputs
    const spend2Inputs: Spend2Inputs = {
      vk: flaxSigner.privkey.vk,
      spendPk: flaxSigner.privkey.spendPk(),
      operationDigest,
      c: opSig.c,
      z: opSig.z,
      oldNote: firstOldNote,
      newNote,
      merkleProof: merkleProofInput,
    };

    // Prove
    const proof = await proveSpend2(spend2Inputs);
    if (!(await verifySpend2Proof(proof))) {
      throw new Error("Proof invalid!");
    }

    // Create spend tx with proof
    const solidityProof = packToSolidityProof(proof.proof);
    const spendTx: ProvenSpendTransaction = {
      commitmentTreeRoot: unprovenSpendTx.commitmentTreeRoot,
      nullifier: unprovenSpendTx.nullifier,
      newNoteCommitment: unprovenSpendTx.newNoteCommitment,
      proof: solidityProof,
      asset: unprovenSpendTx.asset,
      value: unprovenSpendTx.value,
      id: unprovenSpendTx.id,
    };

    // Create operation with spend tx and bundle
    const operation: ProvenOperation = {
      spendTxs: [spendTx],
      refundAddr: unprovenOperation.refundAddr,
      tokens: unprovenOperation.tokens,
      actions: unprovenOperation.actions,
      gasLimit: unprovenOperation.gasLimit,
    };
    const bundle: Bundle = {
      operations: [operation],
    };

    const res = await wallet.processBundle(bundle);
    console.log(res);

    console.log("Bob address: ", bob.address);
    console.log("alice tokens: ", await token.balanceOf(alice.address));
    console.log("bob tokens: ", await token.balanceOf(bob.address));
    console.log("vault tokens: ", await token.balanceOf(vault.address));
  });
});
