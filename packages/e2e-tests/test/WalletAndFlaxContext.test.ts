import { expect } from "chai";
import { ethers, network } from "hardhat";
import { SimpleERC20Token__factory, Vault, Wallet } from "@flax/contracts";
import { SimpleERC20Token } from "@flax/contracts/dist/src/SimpleERC20Token";

import {
  Action,
  SNARK_SCALAR_FIELD,
  Bundle,
  FlaxContext,
  AssetStruct,
  AssetRequest,
  OperationRequest,
  LocalObjectDB,
  LocalMerkleProver,
} from "@flax/sdk";
import { setup } from "../deploy/deployFlax";
import { depositFunds } from "./utils";
import findWorkspaceRoot from "find-yarn-workspace-root";
import * as path from "path";
// eslint-disable-next-line
const ROOT_DIR = findWorkspaceRoot()!;
const ARTIFACTS_DIR = path.join(ROOT_DIR, "circuit-artifacts");
const WASM_PATH = `${ARTIFACTS_DIR}/spend2/spend2_js/spend2.wasm`;
const ZKEY_PATH = `${ARTIFACTS_DIR}/spend2/spend2_cpp/spend2.zkey`;

const ERC20_ID = SNARK_SCALAR_FIELD - 1n;
const PER_SPEND_AMOUNT = 100n;

describe("Wallet", async () => {
  let deployer: ethers.Signer;
  let alice: ethers.Signer;
  let bob: ethers.Signer;
  let vault: Vault;
  let wallet: Wallet;
  let token: SimpleERC20Token;
  let flaxContext: FlaxContext;
  let db: LocalObjectDB;

  async function applySubtreeUpdate() {
    const root = (flaxContext.merkleProver as LocalMerkleProver).root();
    await wallet.applySubtreeUpdate(root, [0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n]);
  }

  beforeEach(async () => {
    [deployer] = await ethers.getSigners();
    const tokenFactory = new SimpleERC20Token__factory(deployer);
    token = await tokenFactory.deploy();
    console.log("Token deployed at: ", token.address);

    const flaxSetup = await setup();
    alice = flaxSetup.alice;
    bob = flaxSetup.bob;
    vault = flaxSetup.vault;
    wallet = flaxSetup.wallet;
    token = token;
    flaxContext = flaxSetup.flaxContext;
    db = flaxSetup.db;
  });

  afterEach(async () => {
    db.clear();
  });

  after(async () => {
    await network.provider.send("hardhat_reset");
  });

  it("Alice deposits two 100 token notes, spends one and transfers 50 tokens to Bob", async () => {
    const asset: AssetStruct = { address: token.address, id: ERC20_ID };

    console.log("Deposit funds and commit note commitments");
    await depositFunds(
      wallet,
      vault,
      token,
      alice,
      flaxContext.signer.address,
      [PER_SPEND_AMOUNT, PER_SPEND_AMOUNT]
    );

    console.log("fill the subtree with zeros");
    await wallet.fillBatchWithZeros();

    console.log("apply subtree update");
    await (
      flaxContext.merkleProver as LocalMerkleProver
    ).fetchLeavesAndUpdate();
    await applySubtreeUpdate();

    console.log("Sync SDK notes manager");
    await flaxContext.syncNotes();
    const notesForAsset = await flaxContext.db.getNotesFor(asset);
    expect(notesForAsset.length).to.equal(2);

    console.log("Sync SDK merkle prover");
    await flaxContext.syncLeaves();
    expect((flaxContext.merkleProver as LocalMerkleProver).root()).to.equal(
      (await wallet.root()).toBigInt()
    );

    console.log("Create asset request to spend 50 units of token");
    const assetRequest: AssetRequest = {
      asset,
      value: 50n,
    };

    console.log("Encode operation request");
    const refundTokens = [token.address];
    const encodedFunction =
      SimpleERC20Token__factory.createInterface().encodeFunctionData(
        "transfer",
        [bob.address, 50]
      );
    const action: Action = {
      contractAddress: token.address,
      encodedFunction: encodedFunction,
    };
    const operationRequest: OperationRequest = {
      assetRequests: [assetRequest],
      refundTokens,
      actions: [action],
    };

    console.log("Create post-proof operation with FlaxContext");
    const operation = await flaxContext.tryCreateProvenOperation(
      operationRequest,
      WASM_PATH,
      ZKEY_PATH
    );

    const bundle: Bundle = {
      operations: [operation],
    };

    console.log("Process bundle");
    await wallet.processBundle(bundle);

    expect((await token.balanceOf(alice.address)).toBigInt()).to.equal(800n);
    expect((await token.balanceOf(bob.address)).toBigInt()).to.equal(50n);
    expect((await token.balanceOf(vault.address)).toBigInt()).to.equal(150n);

    console.log("Sync SDK notes manager post-spend");
    await flaxContext.syncNotes();
    const updatedNotesForAsset = await flaxContext.db.getNotesFor(asset)!;
    const updatedNote = updatedNotesForAsset.find((n) => n.merkleIndex == 16)!; // 3rd note, but the subtree commit put in 14 empty commitments.
    expect(updatedNote.value).to.equal(50n);
  });
});
