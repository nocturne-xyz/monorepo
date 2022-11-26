import { expect } from "chai";
import hre from "hardhat";
import { ethers } from "hardhat";
import { BatchBinaryMerkle } from "@flax/contracts";
import { LocalMerkleProver, LocalObjectDB } from "@flax/sdk";
import { setup } from "../deploy/deployFlax";

describe("LocalMerkle", async () => {
  let merkle: BatchBinaryMerkle;
  let db: LocalObjectDB;
  let localMerkle: LocalMerkleProver;

  beforeEach(async () => {
    db = new LocalObjectDB({ localMerkle: true });

    const flaxSetup = await setup();
    merkle = flaxSetup.merkle;

    localMerkle = new LocalMerkleProver(merkle.address, ethers.provider, db);
  });

  afterEach(async () => {
    db.clear();
  });

  after(async () => {
    await hre.network.provider.send("hardhat_reset");
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
