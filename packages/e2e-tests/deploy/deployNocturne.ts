import { ethers, deployments } from "hardhat";
import * as fs from "fs";
import {
  Wallet__factory,
  Vault__factory,
  JoinSplitVerifier__factory,
  Vault,
  Wallet,
  TestSubtreeUpdateVerifier__factory,
} from "@nocturne-xyz/contracts";

import {
  NocturnePrivKey,
  NocturneSigner,
  NocturneContext,
  LocalObjectDB,
  LocalMerkleProver,
  LocalNotesManager,
} from "@nocturne-xyz/sdk";
import { LocalJoinSplitProver } from "@nocturne-xyz/local-prover";

import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

import findWorkspaceRoot from "find-yarn-workspace-root";
import * as path from "path";

// eslint-disable-next-line
const ROOT_DIR = findWorkspaceRoot()!;
const ARTIFACTS_DIR = path.join(ROOT_DIR, "circuit-artifacts");
const WASM_PATH = `${ARTIFACTS_DIR}/joinsplit/joinsplit_js/joinsplit.wasm`;
const ZKEY_PATH = `${ARTIFACTS_DIR}/joinsplit/joinsplit_cpp/joinsplit.zkey`;
const VKEY_PATH = `${ARTIFACTS_DIR}/joinsplit/joinsplit_cpp/vkey.json`;
const VKEY = JSON.parse(fs.readFileSync(VKEY_PATH).toString());

export interface NocturneSetup {
  alice: ethers.Signer;
  bob: ethers.Signer;
  vault: Vault;
  wallet: Wallet;
  nocturneContext: NocturneContext;
  db: LocalObjectDB;
}

export async function setup(): Promise<NocturneSetup> {
  const db = new LocalObjectDB({ localMerkle: true });
  const sk = BigInt(1);
  const nocturnePrivKey = new NocturnePrivKey(sk);
  const nocturneSigner = new NocturneSigner(nocturnePrivKey);
  const [_, alice, bob] = await ethers.getSigners();

  await deployments.fixture(["NocturneContracts"]);
  const vault = await ethers.getContract("Vault");
  const wallet = await ethers.getContract("Wallet");

  await vault.initialize(wallet.address);

  console.log("Create NocturneContext");
  const prover = new LocalJoinSplitProver(WASM_PATH, ZKEY_PATH, VKEY);
  const merkleProver = new LocalMerkleProver(
    wallet.address,
    ethers.provider,
    db
  );
  const notesManager = new LocalNotesManager(
    db,
    nocturneSigner,
    wallet.address,
    ethers.provider
  );
  const nocturneContext = new NocturneContext(
    nocturneSigner,
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
    nocturneContext,
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

  const joinSplitVerifier = await deploy("JoinSplitVerifier", {
    from: owner,
    contract: {
      abi: JoinSplitVerifier__factory.abi,
      bytecode: JoinSplitVerifier__factory.bytecode,
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
      joinSplitVerifier.address,
      subtreeUpdateVerifier.address,
    ],
    log: true,
    deterministicDeployment: true,
  });
};

export default func;
func.tags = ["NocturneContracts"];
