import { expect } from "chai";
import { ethers, deployments } from "hardhat";
import * as fs from "fs";
import {
  BatchBinaryMerkle__factory,
  PoseidonHasherT3__factory,
  BatchBinaryMerkle,
} from "@flax/contracts";
import {
  FlaxPrivKey,
  FlaxSigner,
  LocalMerkleProver,
  LocalFlaxDB,
  DEFAULT_DB_PATH,
} from "@flax/sdk";

describe("LocalMerkle", async () => {
  let deployer: ethers.Signer;
  let merkle: BatchBinaryMerkle;
  let flaxSigner: FlaxSigner;
  let db: LocalFlaxDB;
  let localMerkle: LocalMerkleProver;

  async function setup() {
    const sk = BigInt(1);
    const flaxPrivKey = new FlaxPrivKey(sk);
    flaxSigner = new FlaxSigner(flaxPrivKey);
    db = new LocalFlaxDB({ localMerkle: true });

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

  after(async () => {
    await db.close();
    fs.rmSync(DEFAULT_DB_PATH, { recursive: true, force: true });
  });

  it("Local merkle prover self syncs", async () => {
    console.log("Depositing 2 notes");
    await merkle.insertLeavesToQueue([0n, 1n]);
    await merkle.commit2FromQueue();

    console.log("Fetching and storing leaves from events");
    await localMerkle.fetchLeavesAndUpdate();
    expect(localMerkle.count).to.eql(2);

    console.log("Ensure leaves match enqueued");
    expect(BigInt(localMerkle.getProof(0).leaf)).to.equal(0n);
    expect(BigInt(localMerkle.getProof(1).leaf)).to.equal(1n);
  });
});
