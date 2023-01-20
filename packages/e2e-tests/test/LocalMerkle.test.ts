import { expect } from "chai";
import { ethers, network } from "hardhat";
import { open } from "lmdb";
import {
  SimpleERC20Token__factory,
  Vault,
  Wallet,
  deployNocturne,
  Wallet__factory,
  Vault__factory,
} from "@nocturne-xyz/contracts";
import { SubtreeUpdater } from "@nocturne-xyz/subtree-updater";
import {
  BinaryPoseidonTree,
  NocturneContext,
  LocalMerkleProver,
  MerkleDB,
} from "@nocturne-xyz/sdk";
import {
  depositFunds,
  getSubtreeUpdateProver,
  setupAliceAndBob,
} from "./utils";
import { SimpleERC20Token } from "@nocturne-xyz/contracts/dist/src/SimpleERC20Token";

const DUMMY_PROXY_ADMIN_OWNER = "0x3CACa7b48D0573D793d3b0279b5F0029180E83b6";

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

    const { walletProxy, vaultProxy } = await deployNocturne(
      DUMMY_PROXY_ADMIN_OWNER,
      { provider: ethers.provider, mockSubtreeUpdateVerifier: true }
    );
    wallet = Wallet__factory.connect(walletProxy.proxyAddress, deployer);
    vault = Vault__factory.connect(vaultProxy.proxyAddress, deployer);

    const setup = await setupAliceAndBob(wallet);
    alice = setup.alice;
    merkleDB = setup.merkleDBAlice;
    nocturneContext = setup.nocturneContextAlice;

    const serverDB = open({ path: `${__dirname}/../db/localMerkleTestDB` });
    const prover = getSubtreeUpdateProver();
    updater = new SubtreeUpdater(wallet, serverDB, prover);
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
