import { ethers, deployments } from "hardhat";
import {
  Wallet__factory,
  Vault__factory,
  Spend2Verifier__factory,
  BatchBinaryMerkle__factory,
  PoseidonHasherT3__factory,
  PoseidonHasherT5__factory,
  PoseidonHasherT6__factory,
  Vault,
  Wallet,
  BatchBinaryMerkle,
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
  merkle: BatchBinaryMerkle;
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
  const merkle = await ethers.getContract("Merkle");
  const wallet = await ethers.getContract("Wallet");

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
    alice,
    bob,
    vault,
    wallet,
    merkle,
    flaxContext,
    db,
  };
}

const circomlibjs = require("circomlibjs");
const poseidonContract = circomlibjs.poseidon_gencontract;
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  // @ts-ignore
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;

  const { owner } = await getNamedAccounts();

  const poseidonT3ABI = poseidonContract.generateABI(2);
  const poseidonT3Bytecode = poseidonContract.createCode(2);
  const poseidonT5ABI = poseidonContract.generateABI(4);
  const poseidonT5Bytecode = poseidonContract.createCode(4);
  const poseidonT6ABI = poseidonContract.generateABI(5);
  const poseidonT6Bytecode = poseidonContract.createCode(5);

  const poseidonT3 = await deploy("PoseidonT3Lib", {
    from: owner,
    contract: {
      abi: poseidonT3ABI,
      bytecode: poseidonT3Bytecode,
    },
    log: true,
    deterministicDeployment: true,
  });
  const poseidonT3Hasher = await deploy("PoseidonT3Hasher", {
    from: owner,
    contract: {
      abi: PoseidonHasherT3__factory.abi,
      bytecode: PoseidonHasherT3__factory.bytecode,
    },
    args: [poseidonT3.address],
    log: true,
    deterministicDeployment: true,
  });

  const poseidonT5 = await deploy("PoseidonT5Lib", {
    from: owner,
    contract: {
      abi: poseidonT5ABI,
      bytecode: poseidonT5Bytecode,
    },
    log: true,
    deterministicDeployment: true,
  });
  const poseidonT5Hasher = await deploy("PoseidonT5Hasher", {
    from: owner,
    contract: {
      abi: PoseidonHasherT5__factory.abi,
      bytecode: PoseidonHasherT5__factory.bytecode,
    },
    args: [poseidonT5.address],
    log: true,
    deterministicDeployment: true,
  });

  const poseidonT6 = await deploy("PoseidonT6Lib", {
    from: owner,
    contract: {
      abi: poseidonT6ABI,
      bytecode: poseidonT6Bytecode,
    },
    log: true,
    deterministicDeployment: true,
  });
  const poseidonT6Hasher = await deploy("PoseidonT6Hasher", {
    from: owner,
    contract: {
      abi: PoseidonHasherT6__factory.abi,
      bytecode: PoseidonHasherT6__factory.bytecode,
    },
    args: [poseidonT6.address],
    log: true,
    deterministicDeployment: true,
  });

  const vault = await deploy("Vault", {
    from: owner,
    contract: {
      abi: Vault__factory.abi,
      bytecode: Vault__factory.bytecode,
    },
    log: true,
    deterministicDeployment: true,
  });

  const verifier = await deploy("Verifier", {
    from: owner,
    contract: {
      abi: Spend2Verifier__factory.abi,
      bytecode: Spend2Verifier__factory.bytecode,
    },
    log: true,
    deterministicDeployment: true,
  });

  const merkle = await deploy("Merkle", {
    from: owner,
    contract: {
      abi: BatchBinaryMerkle__factory.abi,
      bytecode: BatchBinaryMerkle__factory.bytecode,
    },
    args: [32, 0, poseidonT3Hasher.address],
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
      verifier.address,
      merkle.address,
      poseidonT5Hasher.address,
      poseidonT6Hasher.address,
    ],
    log: true,
    deterministicDeployment: true,
  });
};

export default func;
func.tags = ["FlaxContracts"];
