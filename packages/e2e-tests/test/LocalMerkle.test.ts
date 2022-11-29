import { expect } from "chai";
import { ethers, network } from "hardhat";
import {
  SimpleERC20Token__factory,
  Vault,
  Wallet,
} from "@nocturne-xyz/contracts";
import {
  BinaryPoseidonTree,
  FlaxContext,
  LocalMerkleProver,
  LocalObjectDB,
} from "@nocturne-xyz/sdk";
import { setup } from "../deploy/deployFlax";
import { depositFunds } from "./utils";
import { SimpleERC20Token } from "@nocturne-xyz/contracts/dist/src/SimpleERC20Token";

describe("LocalMerkle", async () => {
  let deployer: ethers.Signer;
  let alice: ethers.Signer;
  let wallet: Wallet;
  let vault: Vault;
  let db: LocalObjectDB;
  let localMerkle: LocalMerkleProver;
  let token: SimpleERC20Token;
  let flaxContext: FlaxContext;

  beforeEach(async () => {
    db = new LocalObjectDB({ localMerkle: true });

    [deployer] = await ethers.getSigners();
    const tokenFactory = new SimpleERC20Token__factory(deployer);
    token = await tokenFactory.deploy();
    console.log("Token deployed at: ", token.address);

    const flaxSetup = await setup();
    alice = flaxSetup.alice;
    vault = flaxSetup.vault;
    wallet = flaxSetup.wallet;
    token = token;
    db = flaxSetup.db;
    flaxContext = flaxSetup.flaxContext;

    localMerkle = new LocalMerkleProver(wallet.address, ethers.provider, db);
  });

  async function applySubtreeUpdate() {
    const root = localMerkle.root();
    await wallet.applySubtreeUpdate(root, [0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n]);
  }

  afterEach(async () => {
    db.clear();
  });

  after(async () => {
    await network.provider.send("hardhat_reset");
  });

  it("Local merkle prover self syncs", async () => {
    console.log("Depositing 2 notes");
    const ncs = await depositFunds(
      wallet,
      vault,
      token,
      alice,
      flaxContext.signer.address,
      [100n, 100n]
    );

    console.log("Fetching and storing leaves from events");
    await localMerkle.fetchLeavesAndUpdate();
    expect(localMerkle.count()).to.eql(2);

    console.log("Ensure leaves match enqueued");
    expect(BigInt((await localMerkle.getProof(0)).leaf)).to.equal(ncs[0]);
    expect(BigInt((await localMerkle.getProof(1)).leaf)).to.equal(ncs[1]);

    console.log("filling subtree");
    await wallet.fillBatchWithZeros();

    console.log("local merkle prover picks up the zeros");
    await localMerkle.fetchLeavesAndUpdate();
    expect(localMerkle.count()).to.eql(BinaryPoseidonTree.BATCH_SIZE);

    console.log("Local merkle doesn't care when subtree update is applied");
    await applySubtreeUpdate();
    expect(localMerkle.count()).to.eql(BinaryPoseidonTree.BATCH_SIZE);
    expect(BigInt((await localMerkle.getProof(0)).leaf)).to.equal(ncs[0]);
    expect(BigInt((await localMerkle.getProof(1)).leaf)).to.equal(ncs[1]);
  });
});
