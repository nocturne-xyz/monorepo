import { expect } from "chai";
import { ethers, deployments } from "hardhat";
import {
  Wallet__factory,
  Vault__factory,
  Spend2Verifier__factory,
  TestSubtreeUpdateVerifier__factory,
  PoseidonHasherT3__factory,
  SimpleERC20Token__factory,
  Vault,
  Wallet,
} from "@flax/contracts";
import { SimpleERC20Token } from "@flax/contracts/dist/src/SimpleERC20Token";

import {
  PrivKey,
  Signer,
  Action,
  SNARK_SCALAR_FIELD,
  Bundle,
  FlaxContext,
  AssetStruct,
  AssetRequest,
  OperationRequest,
  FlaxLMDB,
  DEFAULT_DB_PATH,
  LocalMerkleProver,
  LocalNotesManager,
  Note,
  BinaryPoseidonTree,
} from "@flax/sdk";
import * as fs from "fs";
import { Contract } from "hardhat/internal/hardhat-network/stack-traces/model";

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
  let db = new FlaxLMDB({ localMerkle: true });

  async function setup() {
    const sk = BigInt(1);
    const flaxPrivKey = new FlaxPrivKey(sk);
    const flaxSigner = new FlaxSigner(flaxPrivKey);

    [deployer, alice, bob] = await ethers.getSigners();
    await deployments.fixture(["PoseidonLibs"]);

    const poseidonT3Lib = await ethers.getContract("PoseidonT3Lib");

    const poseidonT3Factory = new PoseidonHasherT3__factory(deployer);
    const poseidonHasherT3 = await poseidonT3Factory.deploy(
      poseidonT3Lib.address
    );

    const tokenFactory = new SimpleERC20Token__factory(deployer);
    token = await tokenFactory.deploy();

    const vaultFactory = new Vault__factory(deployer);
    vault = await vaultFactory.deploy();

    const spend2VerifierFactory = new Spend2Verifier__factory(deployer);
    const spend2Verifier = await spend2VerifierFactory.deploy();

    const subtreeUpdateVerifierFactory = new TestSubtreeUpdateVerifier__factory(deployer);
    const subtreeUpdateVerifier = await subtreeUpdateVerifierFactory.deploy();

    const walletFactory = new Wallet__factory(deployer);
    wallet = await walletFactory.deploy(
      vault.address,
      spend2Verifier.address,
      subtreeUpdateVerifier.address,
      poseidonHasherT3.address
    );

    await vault.initialize(wallet.address);

    console.log("Create FlaxContext");
    const prover = new LocalMerkleProver(wallet.address, ethers.provider, db);
    const notesManager = new LocalNotesManager(
      db,
      flaxSigner,
      wallet.address,
      ethers.provider
    );
    flaxContext = new FlaxContext(flaxSigner, prover, notesManager, db);
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
        depositAddr: flaxContext.signer.address.toStruct(),
      });
    }
  }

  async function commitSubtree() {
    const newRoot = (flaxContext.merkleProver as LocalMerkleProver).root();
    await wallet.commitSubtree(newRoot, [0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n]);
  }

  beforeEach(async () => {
    await setup();
  });

  afterEach(async () => {
    db.clear();
  });

  after(async () => {
    await db.close();
    fs.rmSync(DEFAULT_DB_PATH, { recursive: true, force: true });
  });

  it("Alice deposits two 100 token notes, spends one and transfers 50 tokens to Bob", async () => {
    const asset: AssetStruct = { address: token.address, id: ERC20_ID };

    console.log("Deposit funds and commit note commitments");
    await aliceDepositFunds();

    console.log("Commit subtree update on-chain")
    await (
      flaxContext.merkleProver as LocalMerkleProver
    ).fetchLeavesAndUpdate();
    await commitSubtree();

    console.log("Sync SDK notes manager");
    await flaxContext.notesManager.fetchAndStoreNewNotesFromRefunds();
    const notesForAsset = flaxContext.notesManager.db.getNotesFor(asset);
    expect(notesForAsset.length).to.equal(2);

    console.log("Sync SDK merkle prover");
    await (
      flaxContext.merkleProver as LocalMerkleProver
    ).fetchLeavesAndUpdate();
    expect((flaxContext.merkleProver as LocalMerkleProver).root()).to.equal(
      (await wallet.getRoot()).toBigInt()
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
    const operation = await flaxContext.tryCreatePostProofOperation(
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

    console.log("Sync SDK notes manager post-spend");
    await flaxContext.notesManager.fetchAndApplyNewSpends();
    const updatedNotesForAsset =
      flaxContext.notesManager.db.getNotesFor(asset)!;
    const updatedNote = updatedNotesForAsset.find((n) => n.merkleIndex == 16)!; // 3rd note, but the subtree commit put in 14 empty commitments.
    expect(updatedNote.value).to.equal(50n);
  });
});
