import { expect } from "chai";
import { ethers, network } from "hardhat";
import { open } from "lmdb";
import {
  SimpleERC20Token__factory,
  Vault,
  Wallet,
} from "@nocturne-xyz/contracts";
import { SimpleERC20Token } from "@nocturne-xyz/contracts/dist/src/SimpleERC20Token";

import {
  Action,
  SNARK_SCALAR_FIELD,
  Bundle,
  NocturneContext,
  Asset,
  AssetRequest,
  OperationRequest,
  LocalObjectDB,
  LocalMerkleProver,
  MockSubtreeUpdateProver,
} from "@nocturne-xyz/sdk";
import { setup } from "../deploy/deployNocturne";
import { depositFunds } from "./utils";
import { SubtreeUpdater } from "@nocturne-xyz/subtree-updater";

const ERC20_ID = SNARK_SCALAR_FIELD - 1n;
const PER_SPEND_AMOUNT = 100n;

describe("Wallet", async () => {
  let deployer: ethers.Signer;
  let alice: ethers.Signer;
  let bob: ethers.Signer;
  let vault: Vault;
  let wallet: Wallet;
  let token: SimpleERC20Token;
  let nocturneContext: NocturneContext;
  let db: LocalObjectDB;
  let updater: SubtreeUpdater;

  beforeEach(async () => {
    [deployer] = await ethers.getSigners();
    const tokenFactory = new SimpleERC20Token__factory(deployer);
    token = await tokenFactory.deploy();
    console.log("Token deployed at: ", token.address);

    const nocturneSetup = await setup();
    alice = nocturneSetup.alice;
    bob = nocturneSetup.bob;
    vault = nocturneSetup.vault;
    wallet = nocturneSetup.wallet;
    token = token;
    nocturneContext = nocturneSetup.nocturneContext;
    db = nocturneSetup.db;

    const serverDB = open({ path: `${__dirname}/../db/localMerkleTestDB` });
    const prover = new MockSubtreeUpdateProver();
    updater = new SubtreeUpdater(wallet, serverDB, prover);
    await updater.init();
  });

  async function applySubtreeUpdate() {
    await wallet.fillBatchWithZeros();
    await updater.update();
    await updater.tryGenAndSubmitProofs();
  }

  afterEach(async () => {
    await db.clear();
    await updater.dropDB();
  });

  after(async () => {
    await network.provider.send("hardhat_reset");
  });

  it("Alice deposits two 100 token notes, spends one and transfers 50 tokens to Bob", async () => {
    const asset: Asset = { address: token.address, id: ERC20_ID };

    console.log("Deposit funds and commit note commitments");
    await depositFunds(
      wallet,
      vault,
      token,
      alice,
      nocturneContext.signer.address,
      [PER_SPEND_AMOUNT, PER_SPEND_AMOUNT]
    );

    console.log("apply subtree update");
    await applySubtreeUpdate();

    console.log("Sync SDK merkle prover");
    await nocturneContext.syncLeaves();
    expect((nocturneContext.merkleProver as LocalMerkleProver).root()).to.equal(
      (await wallet.root()).toBigInt()
    );

    console.log("Sync SDK notes manager");
    await nocturneContext.syncNotes();
    const notesForAsset = await nocturneContext.db.getNotesFor(asset);
    expect(notesForAsset.length).to.equal(2);

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

    console.log("Create post-proof operation with NocturneContext");
    const operation = await nocturneContext.tryCreateProvenOperation(
      operationRequest
    );

    const bundle: Bundle = {
      operations: [operation],
    };

    console.log("Process bundle");
    await wallet.processBundle(bundle);

    expect((await token.balanceOf(alice.address)).toBigInt()).to.equal(800n);
    expect((await token.balanceOf(bob.address)).toBigInt()).to.equal(50n);
    expect((await token.balanceOf(vault.address)).toBigInt()).to.equal(150n);

    console.log("Sync SDK notes manager post-operation");
    await nocturneContext.syncNotes();
    const updatedNotesForAsset = await nocturneContext.db.getNotesFor(asset)!;
    const FoundNote = updatedNotesForAsset.filter((n) => n.value > 0);
    // There should be one new note of value 50n
    expect(FoundNote.length).to.equal(2);
    expect(FoundNote[1].value).to.equal(50n);
  });
});
