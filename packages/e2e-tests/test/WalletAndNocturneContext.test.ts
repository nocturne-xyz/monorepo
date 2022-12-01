import { expect } from "chai";
import { ethers, network } from "hardhat";
import {
  SimpleERC20Token__factory,
  Vault,
  Wallet,
} from "@nocturne-xyz/contracts";
import { SimpleERC20Token } from "@nocturne-xyz/contracts/dist/src/SimpleERC20Token";
import { SubtreeUpdater, subtreeUpdater } from "@nocturne-xyz/subtree-updater/src/index";
import { open } from "lmdb";
import {
  Action,
  SNARK_SCALAR_FIELD,
  Bundle,
  NocturneContext,
  AssetStruct,
  AssetRequest,
  OperationRequest,
  LocalObjectDB,
  LocalMerkleProver,
  mockSubtreeUpdateProver,
} from "@nocturne-xyz/sdk";
import { setup } from "../deploy/deployNocturne";
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
  let nocturneContext: NocturneContext;
  let db: LocalObjectDB;
  let updater: SubtreeUpdater;

  async function applySubtreeUpdate() {
    await updater.fillbatch();
    await updater.poll();
  }

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

    const serverDB = open({ path: `${__dirname}/../db/walletTestDB`});
    const params = { walletContract: wallet, rootDB: serverDB}
    updater = await subtreeUpdater(params, mockSubtreeUpdateProver);
  });

  afterEach(async () => {
    db.clear();
    updater.dropDb();
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
    await nocturneContext.syncNotes();
    const updatedNotesForAsset = await nocturneContext.db.getNotesFor(asset)!;
    const updatedNote = updatedNotesForAsset.find((n) => n.merkleIndex == 16)!; // 3rd note, but the subtree commit put in 14 empty commitments.
    expect(updatedNote.value).to.equal(50n);
  });
});
