import { expect } from "chai";
import { ethers } from "ethers";
import { open } from "lmdb";
import {
  SimpleERC20Token__factory,
  Vault,
  Wallet,
} from "@nocturne-xyz/contracts";
import { SubtreeUpdater } from "@nocturne-xyz/subtree-updater";
import {
  NocturneContext,
  InMemoryMerkleProver,
  MerkleDB,
  BinaryPoseidonTree,
} from "@nocturne-xyz/sdk";
import { setupNocturne } from "../src/deploy";
import { depositFunds } from "../src/deposit";
import { getSubtreeUpdateProver, sleep } from "../src/utils";
import { SimpleERC20Token } from "@nocturne-xyz/contracts/dist/src/SimpleERC20Token";
import { SyncSubtreeSubmitter } from "@nocturne-xyz/subtree-updater/dist/src/submitter";
import Dockerode from "dockerode";
import { KEYS, KEYS_TO_WALLETS } from "../src/keys";
import { startHardhatNetwork } from "../src/hardhat";

const HH_URL = "http://localhost:8545";

describe("InMemoryMerkle", async () => {
  let docker: Dockerode;
  let hhContainer: Dockerode.Container;

  let provider: ethers.providers.Provider;
  let deployerEoa: ethers.Wallet;
  let aliceEoa: ethers.Wallet;

  let wallet: Wallet;
  let vault: Vault;
  let token: SimpleERC20Token;
  let merkleDBAlice: MerkleDB;
  let merkle: InMemoryMerkleProver;
  let nocturneContextAlice: NocturneContext;
  let updater: SubtreeUpdater;

  beforeEach(async () => {
    docker = new Dockerode();
    hhContainer = await startHardhatNetwork(docker, {
      blockTime: 3_000,
      keys: KEYS,
    });

    provider = new ethers.providers.JsonRpcProvider(HH_URL);
    [deployerEoa, aliceEoa] = KEYS_TO_WALLETS(provider);
    ({ vault, wallet, nocturneContextAlice, merkleDBAlice } =
      await setupNocturne(deployerEoa));

    const tokenFactory = new SimpleERC20Token__factory(deployerEoa);
    token = await tokenFactory.deploy();
    console.log("Token deployed at: ", token.address);

    const serverDB = open({ path: `${__dirname}/../db/merkleTestDB` });
    const prover = getSubtreeUpdateProver();
    const submitter = new SyncSubtreeSubmitter(wallet);
    updater = new SubtreeUpdater(wallet, serverDB, prover, submitter);
    await updater.init();

    merkle = new InMemoryMerkleProver(wallet.address, provider, merkleDBAlice);
  });

  async function applySubtreeUpdate() {
    await wallet.fillBatchWithZeros();
    await updater.pollInsertionsAndTryMakeBatch();
    await updater.tryGenAndSubmitProofs();
    await sleep(5_000);
  }

  afterEach(async () => {
    await hhContainer.stop();
    await hhContainer.remove();
  });

  it("self syncs", async () => {
    console.log("Depositing 2 notes");
    const ncs = await depositFunds(
      wallet,
      vault,
      token,
      aliceEoa,
      nocturneContextAlice.signer.generateRandomStealthAddress(),
      [100n, 100n]
    );

    console.log("Fetching and storing leaves from events");
    await merkle.fetchLeavesAndUpdate();
    expect(merkle.count()).to.eql(2);

    console.log("Ensure leaves match enqueued");
    expect(BigInt((await merkle.getProof(0)).leaf)).to.equal(ncs[0]);
    expect(BigInt((await merkle.getProof(1)).leaf)).to.equal(ncs[1]);

    console.log("applying subtree update");
    await applySubtreeUpdate();

    console.log("merkle prover picks up the zeros");
    await merkle.fetchLeavesAndUpdate();
    expect(merkle.count()).to.eql(BinaryPoseidonTree.BATCH_SIZE);
    expect(BigInt((await merkle.getProof(0)).leaf)).to.equal(ncs[0]);
    expect(BigInt((await merkle.getProof(1)).leaf)).to.equal(ncs[1]);
  });
});
