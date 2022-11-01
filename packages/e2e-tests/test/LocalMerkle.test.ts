import { expect } from "chai";
import { ethers, deployments } from "hardhat";
import * as fs from "fs";
import {
  Wallet__factory,
  Vault__factory,
  Spend2Verifier__factory,
  BatchBinaryMerkle__factory,
  PoseidonHasherT3__factory,
  PoseidonHasherT5__factory,
  PoseidonHasherT6__factory,
  SimpleERC20Token__factory,
  Vault,
  Wallet,
  BatchBinaryMerkle,
} from "@flax/contracts";
import { SimpleERC20Token } from "@flax/contracts/dist/src/SimpleERC20Token";
import {
  FlaxPrivKey,
  FlaxSigner,
  SNARK_SCALAR_FIELD,
  LocalMerkleProver,
  FlaxLMDB,
  Note,
} from "@flax/sdk";

const DB_PATH = "db";
const ERC20_ID = SNARK_SCALAR_FIELD - 1n;
const PER_SPEND_AMOUNT = 100n;

describe("LocalMerkle", async () => {
  let deployer: ethers.Signer, alice: ethers.Signer, bob: ethers.Signer;
  let vault: Vault,
    wallet: Wallet,
    merkle: BatchBinaryMerkle,
    token: SimpleERC20Token;
  let flaxSigner: FlaxSigner;

  async function setup() {
    const sk = BigInt(1);
    const flaxPrivKey = new FlaxPrivKey(sk);
    const vk = flaxPrivKey.vk;
    flaxSigner = new FlaxSigner(flaxPrivKey);

    [deployer, alice, bob] = await ethers.getSigners();
    await deployments.fixture(["PoseidonLibs"]);

    const poseidonT3Lib = await ethers.getContract("PoseidonT3Lib");
    const poseidonT5Lib = await ethers.getContract("PoseidonT5Lib");
    const poseidonT6Lib = await ethers.getContract("PoseidonT6Lib");

    const poseidonT3Factory = new PoseidonHasherT3__factory(deployer);
    const poseidonHasherT3 = await poseidonT3Factory.deploy(
      poseidonT3Lib.address
    );

    const poseidonT5Factory = new PoseidonHasherT5__factory(deployer);
    const poseidonHasherT5 = await poseidonT5Factory.deploy(
      poseidonT5Lib.address
    );

    const poseidonT6Factory = new PoseidonHasherT6__factory(deployer);
    const poseidonHasherT6 = await poseidonT6Factory.deploy(
      poseidonT6Lib.address
    );

    const tokenFactory = new SimpleERC20Token__factory(deployer);
    token = await tokenFactory.deploy();

    const vaultFactory = new Vault__factory(deployer);
    vault = await vaultFactory.deploy();

    const verifierFactory = new Spend2Verifier__factory(deployer);
    const verifier = await verifierFactory.deploy();

    const merkleFactory = new BatchBinaryMerkle__factory(deployer);
    merkle = await merkleFactory.deploy(32, 0, poseidonHasherT3.address);

    const walletFactory = new Wallet__factory(deployer);
    wallet = await walletFactory.deploy(
      vault.address,
      verifier.address,
      merkle.address,
      poseidonHasherT5.address,
      poseidonHasherT6.address
    );

    await vault.initialize(wallet.address);
  }

  async function aliceDepositFunds(notes: Note[]) {
    token.reserveTokens(alice.address, 1000);
    await token.connect(alice).approve(vault.address, 200);

    for (let i = 0; i < 2; i++) {
      await wallet.connect(alice).depositFunds({
        spender: alice.address as string,
        asset: notes[i].asset,
        value: notes[i].value,
        id: notes[i].id,
        depositAddr: notes[i].owner,
      });
    }
  }

  beforeEach(async () => {
    await setup();
  });

  afterEach(() => {
    fs.rmSync(DB_PATH, { recursive: true, force: true });
  });

  it("Local merkle prover self syncs", async () => {
    const lmdb = new FlaxLMDB({ dbPath: DB_PATH, localMerkle: true });
    const localMerkle = new LocalMerkleProver(
      merkle.address,
      ethers.provider,
      lmdb
    );

    const notes = [
      new Note({
        owner: flaxSigner.address.toStruct(),
        nonce: 0n,
        asset: token.address,
        id: ERC20_ID,
        value: PER_SPEND_AMOUNT,
      }),
      new Note({
        owner: flaxSigner.address.toStruct(),
        nonce: 1n,
        asset: token.address,
        id: ERC20_ID,
        value: PER_SPEND_AMOUNT,
      }),
    ];

    console.log("Depositing 2 notes");
    await aliceDepositFunds(notes);
    await wallet.commit2FromQueue();

    console.log("Fetching and storing leaves from events");
    await localMerkle.fetchAndStoreNewLeaves();
    expect(localMerkle.count).to.eql(2);

    console.log("Ensure leaves match enqueued");
    expect(BigInt(localMerkle.getProof(0).leaf)).to.eql(
      notes[0].toCommitment()
    );
    expect(BigInt(localMerkle.getProof(1).leaf)).to.eql(
      notes[1].toCommitment()
    );
  });
});
