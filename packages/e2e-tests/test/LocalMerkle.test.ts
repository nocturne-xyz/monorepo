import { expect } from "chai";
import { ethers } from "hardhat";
import * as fs from "fs";
import {
  OffchainMerkleTree,
  OffchainMerkleTree__factory,
  TestSubtreeUpdateVerifier__factory,
} from "@flax/contracts";
import {
  LocalMerkleProver,
  FlaxLMDB,
  DEFAULT_DB_PATH,
  BinaryPoseidonTree
} from "@flax/sdk";

describe("LocalMerkle", async () => {
  let deployer: ethers.Signer;
  let merkle: OffchainMerkleTree;
  let db: FlaxLMDB;
  let localMerkle: LocalMerkleProver;

  async function setup() {
    db = new FlaxLMDB({ dbPath: DEFAULT_DB_PATH, localMerkle: true });

    [deployer] = await ethers.getSigners();
	const subtreeupdateVerifierFactory = new TestSubtreeUpdateVerifier__factory(deployer);
	const subtreeUpdateVerifier = await subtreeupdateVerifierFactory.deploy();

    const merkleFactory = new OffchainMerkleTree__factory(deployer);
    merkle = await merkleFactory.deploy(subtreeUpdateVerifier.address);

    localMerkle = new LocalMerkleProver(merkle.address, ethers.provider, db);
  }

  async function fillBatch() {
	const batchLen = await merkle.batchLen();
	const amountToInsert = BinaryPoseidonTree.BATCH_SIZE - batchLen.toNumber();
	for (let i = 0; i < amountToInsert; i++) {
		await merkle.insertNoteCommitment(0n);
	}
  }

  async function applySubtreeUpdate() {
	const root = localMerkle.root();
	await merkle.applySubtreeUpdate(root, [0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n]);
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
    await merkle.insertNoteCommitments([0n, 1n]);

    console.log("Fetching and storing leaves from events");
    await localMerkle.fetchLeavesAndUpdate();
    expect(localMerkle.count).to.eql(2);

    console.log("Ensure leaves match enqueued");
    expect(BigInt(localMerkle.getProof(0).leaf)).to.equal(0n);
    expect(BigInt(localMerkle.getProof(1).leaf)).to.equal(1n);

    console.log("filling subtree");
	await fillBatch();

	console.log("local merkle prover picks up the zeros")
    await localMerkle.fetchLeavesAndUpdate();
	expect(localMerkle.count).to.eql(BinaryPoseidonTree.BATCH_SIZE);


	console.log("Local merkle doesn't care when subtree update is applied")
	await applySubtreeUpdate();
    expect(BigInt(localMerkle.getProof(0).leaf)).to.equal(0n);
    expect(BigInt(localMerkle.getProof(1).leaf)).to.equal(1n);
  });
});
