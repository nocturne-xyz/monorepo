import { expect } from "chai";
import { ethers, deployments } from "hardhat";
import {
  BatchBinaryMerkle__factory,
  PoseidonHasherT3__factory,
  BatchBinaryMerkle,
} from "@flax/contracts";
import { LocalMerkleProver, LocalObjectDB } from "@flax/sdk";

describe("LocalMerkle", async () => {
  let deployer: ethers.Signer;
  let merkle: BatchBinaryMerkle;
  let db: LocalObjectDB;
  let localMerkle: LocalMerkleProver;

  async function setup() {
    db = new LocalObjectDB({ localMerkle: true });

    [deployer] = await ethers.getSigners();
    await deployments.fixture(["PoseidonLibs"]);

    const poseidonT3Lib = await ethers.getContract("PoseidonT3Lib");
    const poseidonT3Factory = new PoseidonHasherT3__factory(deployer);
    const poseidonHasherT3 = await poseidonT3Factory.deploy(
      poseidonT3Lib.address
    );

    const merkleFactory = new BatchBinaryMerkle__factory(deployer);
    merkle = await merkleFactory.deploy(32, 0, poseidonHasherT3.address);

    localMerkle = new LocalMerkleProver(merkle.address, ethers.provider, db);
  }

  beforeEach(async () => {
    await setup();
  });

  afterEach(async () => {
    db.clear();
  });

  it("Local merkle prover self syncs", async () => {
    console.log("Depositing 2 notes");
    await merkle.insertLeavesToQueue([0n, 1n]);
    await merkle.commit2FromQueue();

    console.log("Fetching and storing leaves from events");
    await localMerkle.fetchLeavesAndUpdate();
    expect(localMerkle.localTree.count).to.eql(2);

    console.log("Ensure leaves match enqueued");
    expect(BigInt((await localMerkle.getProof(0)).leaf)).to.equal(0n);
    expect(BigInt((await localMerkle.getProof(1)).leaf)).to.equal(1n);
  });
});
