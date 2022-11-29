import { expect } from "chai";
import { ethers, network } from "hardhat";
import {
  SimpleERC20Token__factory,
  Vault,
  Wallet,
} from "@nocturne-xyz/contracts";
import { subtreeUpdater, SubtreeUpdater } from "@nocturne-xyz/subtree-updater/src/index";
import { open } from "lmdb";
import {
  BinaryPoseidonTree,
  NocturneContext,
  LocalMerkleProver,
  LocalObjectDB,
  mockSubtreeUpdateProver,
} from "@nocturne-xyz/sdk";
import { setup } from "../deploy/deployNocturne";
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
  let nocturneContext: NocturneContext;
  let updater: SubtreeUpdater;
  
  async function applySubtreeUpdate() {
    await updater.fillbatch();
    await updater.poll();
  }

  beforeEach(async () => {
    db = new LocalObjectDB({ localMerkle: true });

    [deployer] = await ethers.getSigners();
    const tokenFactory = new SimpleERC20Token__factory(deployer);
    token = await tokenFactory.deploy();
    console.log("Token deployed at: ", token.address);

    const nocturneSetup = await setup();
    alice = nocturneSetup.alice;
    vault = nocturneSetup.vault;
    wallet = nocturneSetup.wallet;
    token = token;
    db = nocturneSetup.db;
    nocturneContext = nocturneSetup.nocturneContext;

    const serverDB = open({ path: `${__dirname}/../db/localMerkleTestDB`});
    const params = { walletContract: wallet, rootDB: serverDB}
    updater = await subtreeUpdater(params, mockSubtreeUpdateProver);

    localMerkle = new LocalMerkleProver(wallet.address, ethers.provider, db);
  });

  afterEach(async () => {
    db.clear();
  });

  after(async () => {
    await network.provider.send("hardhat_reset");
    updater.dropDb();
  });

  it("Local merkle prover self syncs", async () => {
    console.log("Depositing 2 notes");
    const ncs = await depositFunds(
      wallet,
      vault,
      token,
      alice,
      nocturneContext.signer.address,
      [100n, 100n]
    );

    console.log("Fetching and storing leaves from events");
    await localMerkle.fetchLeavesAndUpdate();
    expect(localMerkle.count()).to.eql(2);

    console.log("Ensure leaves match enqueued");
    expect(BigInt((await localMerkle.getProof(0)).leaf)).to.equal(ncs[0]);
    expect(BigInt((await localMerkle.getProof(1)).leaf)).to.equal(ncs[1]);

    console.log("applying subtree update");
    await applySubtreeUpdate();

    console.log("local merkle prover picks up the zeros");
    await localMerkle.fetchLeavesAndUpdate();
    expect(localMerkle.count()).to.eql(BinaryPoseidonTree.BATCH_SIZE);
    expect(localMerkle.root()).to.eql((await wallet.root()).toBigInt());
    expect(BigInt((await localMerkle.getProof(0)).leaf)).to.equal(ncs[0]);
    expect(BigInt((await localMerkle.getProof(1)).leaf)).to.equal(ncs[1]);
  });
});
