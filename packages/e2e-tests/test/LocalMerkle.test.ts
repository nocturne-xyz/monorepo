import { expect } from "chai";
import { ethers } from "hardhat";
import * as fs from "fs";
import {
  Wallet,
  Wallet__factory,
  TestSubtreeUpdateVerifier__factory,
  Spend2Verifier__factory,
  Vault__factory,
  Vault,
  SimpleERC20Token__factory
} from "@flax/contracts";
import {
  LocalMerkleProver,
  FlaxLMDB,
  DEFAULT_DB_PATH,
  BinaryPoseidonTree,
  FlaxPrivKey,
  FlaxSigner,
} from "@flax/sdk";
import { SimpleERC20Token } from "@flax/contracts/dist/src/SimpleERC20Token";
import { depositFunds } from "./utils";

describe("LocalMerkle", async () => {
  let deployer: ethers.Signer;
  let alice: ethers.Signer;
  let wallet: Wallet;
  let token: SimpleERC20Token;
  let vault: Vault;
  let db: FlaxLMDB;
  let localMerkle: LocalMerkleProver;
  let flaxSigner: FlaxSigner;

  async function setup() {
    const sk = BigInt(1);
    const flaxPrivKey = new FlaxPrivKey(sk);
    flaxSigner = new FlaxSigner(flaxPrivKey);

    db = new FlaxLMDB({ dbPath: DEFAULT_DB_PATH, localMerkle: true });

    [deployer, alice] = await ethers.getSigners();
    const subtreeupdateVerifierFactory = new TestSubtreeUpdateVerifier__factory(deployer);
    const subtreeUpdateVerifier = await subtreeupdateVerifierFactory.deploy();

    const spend2VerifierFactory = new Spend2Verifier__factory(deployer);
    const spend2Verifier = await spend2VerifierFactory.deploy();

    const tokenFactory = new SimpleERC20Token__factory(deployer);
    token = await tokenFactory.deploy();

    const vaultFactory = new Vault__factory(deployer);
    vault = await vaultFactory.deploy();

    const walletFactory = new Wallet__factory(deployer);
    wallet = await walletFactory.deploy(vault.address, spend2Verifier.address, subtreeUpdateVerifier.address);

    await vault.initialize(wallet.address);
    localMerkle = new LocalMerkleProver(wallet.address, ethers.provider, db);
  }

  async function applySubtreeUpdate() {
    const root = localMerkle.root();
    await wallet.applySubtreeUpdate(root, [0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n]);
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

  it("Local merkle prover self syncs", async () => {
    console.log("Depositing 2 notes");
    const ncs = await depositFunds(
      wallet,
      vault,
      token,
      alice,
      flaxSigner.address,
      [100n, 100n] 
    );

    console.log("Fetching and storing leaves from events");
    await localMerkle.fetchLeavesAndUpdate();
    expect(localMerkle.count).to.eql(2);

    console.log("Ensure leaves match enqueued");
    expect(BigInt(localMerkle.getProof(0).leaf)).to.equal(ncs[0]);
    expect(BigInt(localMerkle.getProof(1).leaf)).to.equal(ncs[1]);

    console.log("filling subtree");
    await wallet.fillBatchWithZeros();

    console.log("local merkle prover picks up the zeros")
    await localMerkle.fetchLeavesAndUpdate();
    expect(localMerkle.count).to.eql(BinaryPoseidonTree.BATCH_SIZE);

    console.log("Local merkle doesn't care when subtree update is applied")
    await applySubtreeUpdate();
    expect(localMerkle.count).to.eql(BinaryPoseidonTree.BATCH_SIZE);
    expect(BigInt(localMerkle.getProof(0).leaf)).to.equal(ncs[0]);
    expect(BigInt(localMerkle.getProof(1).leaf)).to.equal(ncs[1]);
  });
});
