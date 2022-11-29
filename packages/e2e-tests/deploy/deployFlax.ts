import { ethers, deployments } from "hardhat";
import {
  Wallet__factory,
  Vault__factory,
  Spend2Verifier__factory,
  Vault,
  Wallet,
  TestSubtreeUpdateVerifier__factory,
} from "@flax/contracts";

import {
  FlaxPrivKey,
  FlaxSigner,
  FlaxContext,
  LocalObjectDB,
  LocalMerkleProver,
  LocalNotesManager,
} from "@flax/sdk";
import { LocalSpend2Prover } from "@flax/local-prover";

import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

export interface FlaxSetup {
  alice: ethers.Signer;
  bob: ethers.Signer;
  vault: Vault;
  wallet: Wallet;
  flaxContext: FlaxContext;
  db: LocalObjectDB;
}

export async function setup(): Promise<FlaxSetup> {
  const db = new LocalObjectDB({ localMerkle: true });
  const sk = BigInt(1);
  const flaxPrivKey = new FlaxPrivKey(sk);
  const flaxSigner = new FlaxSigner(flaxPrivKey);
  const [_, alice, bob] = await ethers.getSigners();

  await deployments.fixture(["FlaxContracts"]);
  const vault = await ethers.getContract("Vault");
  const wallet = await ethers.getContract("Wallet");

  await vault.initialize(wallet.address);

  console.log("Create FlaxContext");
  const prover = new LocalSpend2Prover();
  const merkleProver = new LocalMerkleProver(
    wallet.address,
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
    alice,
    bob,
    vault,
    wallet,
    flaxContext,
    db,
  };
}

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  // @ts-ignore
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;

  const { owner } = await getNamedAccounts();

  const vault = await deploy("Vault", {
    from: owner,
    contract: {
      abi: Vault__factory.abi,
      bytecode: Vault__factory.bytecode,
    },
    log: true,
    deterministicDeployment: true,
  });

  const spend2Verifier = await deploy("Spend2Verifier", {
    from: owner,
    contract: {
      abi: Spend2Verifier__factory.abi,
      bytecode: Spend2Verifier__factory.bytecode,
    },
    log: true,
    deterministicDeployment: true,
  });

  const subtreeUpdateVerifier = await deploy("SubtreeUpdateVerifier", {
    from: owner,
    contract: {
      abi: TestSubtreeUpdateVerifier__factory.abi,
      bytecode: TestSubtreeUpdateVerifier__factory.bytecode,
    },
    log: true,
    deterministicDeployment: true,
  });

  await deploy("Wallet", {
    from: owner,
    contract: {
      abi: Wallet__factory.abi,
      bytecode: Wallet__factory.bytecode,
    },
    args: [
      vault.address,
      spend2Verifier.address,
      subtreeUpdateVerifier.address,
    ],
    log: true,
    deterministicDeployment: true,
  });
};

export default func;
func.tags = ["FlaxContracts"];
