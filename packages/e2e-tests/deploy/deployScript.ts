import { ethers, deployments } from "hardhat";
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
  FlaxContext,
  LocalFlaxDB,
  LocalMerkleProver,
  LocalNotesManager,
} from "@flax/sdk";
import { LocalSpend2Prover } from "@flax/local-prover";

export interface FlaxSetup {
  deployer: ethers.Signer;
  alice: ethers.Signer;
  bob: ethers.Signer;
  vault: Vault;
  wallet: Wallet;
  merkle: BatchBinaryMerkle;
  token: SimpleERC20Token;
  flaxContext: FlaxContext;
  db: LocalFlaxDB;
}

export async function setup(): Promise<FlaxSetup> {
  const db = new LocalFlaxDB({ localMerkle: true });
  const sk = BigInt(1);
  const flaxPrivKey = new FlaxPrivKey(sk);
  const flaxSigner = new FlaxSigner(flaxPrivKey);

  const [deployer, alice, bob] = await ethers.getSigners();
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
  const token = await tokenFactory.deploy();

  const vaultFactory = new Vault__factory(deployer);
  const vault = await vaultFactory.deploy();

  const verifierFactory = new Spend2Verifier__factory(deployer);
  const verifier = await verifierFactory.deploy();

  const merkleFactory = new BatchBinaryMerkle__factory(deployer);
  const merkle = await merkleFactory.deploy(32, 0, poseidonHasherT3.address);

  const walletFactory = new Wallet__factory(deployer);
  const wallet = await walletFactory.deploy(
    vault.address,
    verifier.address,
    merkle.address,
    poseidonHasherT5.address,
    poseidonHasherT6.address
  );

  await vault.initialize(wallet.address);

  console.log("Create FlaxContext");
  const prover = new LocalSpend2Prover();
  const merkleProver = new LocalMerkleProver(
    merkle.address,
    ethers.provider,
    db
  );
  const notesManager = new LocalNotesManager(
    db,
    flaxSigner,
    wallet.address,
    ethers.provider
  );
  const flaxContext = new FlaxContext(
    flaxSigner,
    prover,
    merkleProver,
    notesManager,
    db
  );

  return {
    deployer,
    alice,
    bob,
    vault,
    wallet,
    merkle,
    token,
    flaxContext,
    db,
  };
}
