import { expect } from "chai";
import { ethers, deployments } from "hardhat";
import * as fs from "fs";
import {
  OffchainMerkleTree__factory,
  OffchainMerkleTree,
  PoseidonHasherT3__factory,
  TestSubtreeUpdateVerifier__factory,
} from "@flax/contracts";
import {
  FlaxPrivKey,
  FlaxSigner,
  LocalMerkleProver,
  FlaxLMDB,
  DEFAULT_DB_PATH,
  BinaryPoseidonTree,
} from "@flax/sdk";

describe("LocalMerkle", async () => {
  let deployer: ethers.Signer;
  let merkle: OffchainMerkleTree;
  let flaxSigner: FlaxSigner;
  let db: FlaxLMDB;
  let localMerkle: LocalMerkleProver;

  async function setup() {
    const sk = BigInt(1);
    const flaxPrivKey = new FlaxPrivKey(sk);
    flaxSigner = new FlaxSigner(flaxPrivKey);
    db = new FlaxLMDB({ dbPath: DEFAULT_DB_PATH, localMerkle: true });

    [deployer] = await ethers.getSigners();
    await deployments.fixture(["PoseidonLibs"]);

    const poseidonT3Lib = await ethers.getContract("PoseidonT3Lib");
    const poseidonT3Factory = new PoseidonHasherT3__factory(deployer);

    // we use th test subtree update verifier here bceause we aren't actually depositing and stuff here
    const subtreeUpdateVerifierFactory = new TestSubtreeUpdateVerifier__factory(deployer);

    const [poseidonHasherT3, subtreeUpdateVerifier] = await Promise.all([
      poseidonT3Factory.deploy(
        poseidonT3Lib.address
      ),
      subtreeUpdateVerifierFactory.deploy(),
    ]);

    const merkleFactory = new OffchainMerkleTree__factory(deployer);
    merkle = await merkleFactory.deploy(subtreeUpdateVerifier.address, poseidonHasherT3.address);

    localMerkle = new LocalMerkleProver(merkle.address, ethers.provider, db);
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

  function dummyProof() {
    return [0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n]
  }

  it("Local merkle prover self syncs", async () => {
    const tree = new BinaryPoseidonTree();

    console.log("Depositing 2 notes");
    await merkle.insertLeavesToQueue([0n, 1n]);

    console.log("Fetching and storing leaves from events");
    await localMerkle.fetchLeavesAndUpdate();
    expect(localMerkle.count).to.eql(2);
    expect(localMerkle.lastCommittedIndex).to.eql(0);

    // compute newRoot
    tree.insert(6n);
    tree.insert(9n);
    [...Array(14).keys()].forEach(_ => tree.insert(0n));
    const newRoot = tree.root();

    console.log("Committing subtree")

    const tx = await merkle.commitSubtree(
      newRoot,
      dummyProof() as any
    );
    const receipt = await tx.wait();
    console.log(receipt);

    console.log("updating after the commit")
    await localMerkle.fetchLeavesAndUpdate();
    expect(localMerkle.count).to.eql(16);
    expect(localMerkle.lastCommittedIndex).to.eql(16);

    console.log("Ensure leaves match enqueued");
    expect(BigInt(localMerkle.getProof(0).leaf)).to.equal(0n);
    expect(BigInt(localMerkle.getProof(1).leaf)).to.equal(1n);
  });
});
