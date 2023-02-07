import { expect } from "chai";
import { ethers, network } from "hardhat";
import { open } from "lmdb";
import {
  SimpleERC20Token__factory,
  Vault,
  Wallet,
} from "@nocturne-xyz/contracts";
import { SubtreeUpdater } from "@nocturne-xyz/subtree-updater";
import {
  BinaryPoseidonTree,
  NocturneContext,
  LocalMerkleProver,
  MerkleDB,
} from "@nocturne-xyz/sdk";
import { setupNocturne } from "../utils/deploy";
import { depositFunds, getSubtreeUpdateProver } from "../utils/test";
import { SimpleERC20Token } from "@nocturne-xyz/contracts/dist/src/SimpleERC20Token";
import { SyncSubtreeSubmitter } from "@nocturne-xyz/subtree-updater/dist/src/submitter";

describe("LocalMerkle", async () => {
  let deployer: ethers.Signer;
  let alice: ethers.Signer;
  let wallet: Wallet;
  let vault: Vault;
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

    const nocturneSetup = await setupNocturne(deployer);
    alice = nocturneSetup.alice;
    vault = nocturneSetup.vault;
    wallet = nocturneSetup.wallet;
    token = token;
    merkleDB = nocturneSetup.merkleDBAlice;
    nocturneContext = nocturneSetup.nocturneContextAlice;

    const serverDB = open({ path: `${__dirname}/../db/localMerkleTestDB` });
    const prover = getSubtreeUpdateProver();
    const submitter = new SyncSubtreeSubmitter(wallet);
    updater = new SubtreeUpdater(wallet, serverDB, prover, submitter);
    await updater.init();

    localMerkle = new LocalMerkleProver(
      wallet.address,
      ethers.provider,
      merkleDB
    );
  });

  async function applySubtreeUpdate() {
    await wallet.fillBatchWithZeros();
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
    expect(BigInt((await localMerkle.getProof(0)).leaf)).to.equal(ncs[0]);
    expect(BigInt((await localMerkle.getProof(1)).leaf)).to.equal(ncs[1]);
  });
});
