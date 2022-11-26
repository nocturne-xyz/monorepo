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
  let flaxSigner: FlaxSigner;

  beforeEach(async () => {
    db = new LocalObjectDB({ localMerkle: true });

    const flaxSetup = await setup();
    merkle = flaxSetup.merkle;

    localMerkle = new LocalMerkleProver(merkle.address, ethers.provider, db);
  }

  async function applySubtreeUpdate() {
    const root = localMerkle.root();
	await wallet.applySubtreeUpdate(root, [0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n]);
  }
    
  });

  afterEach(async () => {
    db.clear();
  });

  after(async () => {
    await hre.network.provider.send("hardhat_reset");
  });

  it("Local merkle prover self syncs", async () => {
    console.log("Depositing 2 notes");
    const ncs = await depositFunds(
      wallet,
      vault,
      token,
      alice,
      flaxSigner.address,
      [100n, 100n] 
    );

    console.log("Fetching and storing leaves from events");
    await localMerkle.fetchLeavesAndUpdate();
    expect(localMerkle.localTree.count).to.eql(2);

    console.log("Ensure leaves match enqueued");
    expect(BigInt(localMerkle.getProof(0).leaf)).to.equal(ncs[0]);
    expect(BigInt(localMerkle.getProof(1).leaf)).to.equal(ncs[1]);

    console.log("filling subtree");
    await wallet.fillBatchWithZeros();

    console.log("local merkle prover picks up the zeros")
    await localMerkle.fetchLeavesAndUpdate();
    expect(localMerkle.count).to.eql(BinaryPoseidonTree.BATCH_SIZE);

    console.log("Local merkle doesn't care when subtree update is applied")
    await applySubtreeUpdate();
    expect(localMerkle.count).to.eql(BinaryPoseidonTree.BATCH_SIZE);
    expect(BigInt(localMerkle.getProof(0).leaf)).to.equal(ncs[0]);
    expect(BigInt(localMerkle.getProof(1).leaf)).to.equal(ncs[1]);
  });
});
