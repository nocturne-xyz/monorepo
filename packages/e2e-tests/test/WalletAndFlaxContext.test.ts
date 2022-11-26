import { expect } from "chai";
import { ethers } from "hardhat";
import {
  SimpleERC20Token__factory,
  Vault,
  Wallet,
  BatchBinaryMerkle,
} from "@flax/contracts";
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
  let deployer: ethers.Signer, alice: ethers.Signer, bob: ethers.Signer;
  let vault: Vault,
    wallet: Wallet,
    merkle: BatchBinaryMerkle,
    token: SimpleERC20Token;
  let flaxContext: FlaxContext;
  let db: LocalObjectDB;

  async function aliceDepositFunds() {
    await token.reserveTokens(alice.address, 1000);
    await token.connect(alice).approve(vault.address, 200);

    for (let i = 0; i < 2; i++) {
      await wallet.connect(alice).depositFunds({
        spender: alice.address as string,
        asset: token.address,
        value: PER_SPEND_AMOUNT,
        id: ERC20_ID,
        depositAddr: flaxContext.signer.address.toStruct(),
      });
    }
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
    merkle = flaxSetup.merkle;
    token = token;
    flaxContext = flaxSetup.flaxContext;
    db = flaxSetup.db;
  });

  afterEach(async () => {
    db.clear();
  });

  after(async () => {
    await hre.network.provider.send("hardhat_reset");
  });

  it("Alice deposits two 100 token notes, spends one and transfers 50 tokens to Bob", async () => {
    const asset: AssetStruct = { address: token.address, id: ERC20_ID };

    console.log("Deposit funds and commit note commitments");
    await aliceDepositFunds();
    await wallet.commit2FromQueue();

    console.log("Sync SDK notes manager");
    await flaxContext.syncNotes();
    const notesForAsset = await flaxContext.db.getNotesFor(asset);
    expect(notesForAsset.length).to.equal(2);

    console.log("Sync SDK merkle prover");
    await flaxContext.syncLeaves();
    expect(
      (flaxContext.merkleProver as LocalMerkleProver).localTree.root()
    ).to.equal((await wallet.getRoot()).toBigInt());

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
    const updatedNote = updatedNotesForAsset.find((n) => n.merkleIndex == 2)!; // 3rd note
    expect(updatedNote.value).to.equal(50n);
  });
});
