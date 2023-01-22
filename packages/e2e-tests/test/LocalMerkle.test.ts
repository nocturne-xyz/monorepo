import { expect } from "chai";
import { ethers, network } from "hardhat";
import { open } from "lmdb";
import {
  SimpleERC20Token__factory,
  Accountant,
  Wallet,
} from "@nocturne-xyz/contracts";
import { SubtreeUpdater } from "@nocturne-xyz/subtree-updater";
import {
  BinaryPoseidonTree,
  NocturneContext,
  LocalMerkleProver,
  MerkleDB,
} from "@nocturne-xyz/sdk";
import { setup } from "../deploy/deployNocturne";
import { depositFunds, getSubtreeUpdateProver } from "./utils";
import { SimpleERC20Token } from "@nocturne-xyz/contracts/dist/src/SimpleERC20Token";

describe("LocalMerkle", async () => {
  let deployer: ethers.Signer;
  let alice: ethers.Signer;
  let wallet: Wallet;
  let accountant: Accountant;
  let token: SimpleERC20Token;
  let merkleDB: MerkleDB;
  let localMerkle: LocalMerkleProver;
  let nocturneContext: NocturneContext;
  let updater: SubtreeUpdater;

  beforeEach(async () => {
    [deployer] = await ethers.getSigners();
    const tokenFactory = new SimpleERC20Token__factory(deployer);
    token = await tokenFactory.deploy();
    console.log("Token deployed at: ", token.address);

    const nocturneSetup = await setup();
    alice = nocturneSetup.alice;
    accountant = nocturneSetup.accountant;
    wallet = nocturneSetup.wallet;
    token = token;
    merkleDB = nocturneSetup.merkleDBAlice;
    nocturneContext = nocturneSetup.nocturneContextAlice;

    const serverDB = open({ path: `${__dirname}/../db/localMerkleTestDB` });
    const prover = getSubtreeUpdateProver();
    updater = new SubtreeUpdater(accountant, serverDB, prover);
    await updater.init();

    localMerkle = new LocalMerkleProver(
      accountant.address,
      ethers.provider,
      merkleDB
    );
  });

  async function applySubtreeUpdate() {
    await accountant.fillBatchWithZeros();
    await updater.pollInsertionsAndTryMakeBatch();
    await updater.tryGenAndSubmitProofs();
  }

  afterEach(async () => {
    await merkleDB.kv.clear();
    await updater.dropDB();
    await network.provider.send("hardhat_reset");
  });

  it("Local merkle prover self syncs", async () => {
    console.log("Depositing 2 notes");
    const ncs = await depositFunds(
      wallet,
      accountant,
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
    expect(BigInt((await localMerkle.getProof(0)).leaf)).to.equal(ncs[0]);
    expect(BigInt((await localMerkle.getProof(1)).leaf)).to.equal(ncs[1]);
  });
});
