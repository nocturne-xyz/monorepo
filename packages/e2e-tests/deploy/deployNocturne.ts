import { ethers, deployments } from "hardhat";
import * as fs from "fs";
import {
  Wallet__factory,
  Vault__factory,
  JoinSplitVerifier__factory,
  Vault,
  Wallet,
  SubtreeUpdateVerifier__factory,
  TestSubtreeUpdateVerifier__factory,
  TransparentUpgradeableProxy__factory,
  Handler__factory,
  Handler,
} from "@nocturne-xyz/contracts";

import {
  NocturnePrivKey,
  NocturneSigner,
  NocturneContext,
  InMemoryKVStore,
  NotesDB,
  MerkleDB,
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
  handler: Handler;
  notesDBAlice: NotesDB;
  merkleDBAlice: MerkleDB;
  nocturneContextAlice: NocturneContext;
  notesDBBob: NotesDB;
  merkleDBBob: MerkleDB;
  nocturneContextBob: NocturneContext;
}

function setupNocturneContext(
  sk: bigint,
  handler: Handler,
  notesDB: NotesDB,
  merkleDB: MerkleDB
): NocturneContext {
  const nocturnePrivKey = new NocturnePrivKey(sk);
  const nocturneSigner = new NocturneSigner(nocturnePrivKey);

  const prover = new LocalJoinSplitProver(WASM_PATH, ZKEY_PATH, VKEY);
  const merkleProver = new LocalMerkleProver(
    handler.address,
    ethers.provider,
    merkleDB
  );

  const notesManager = new LocalNotesManager(
    notesDB,
    nocturneSigner,
    handler.address,
    ethers.provider
  );
  return new NocturneContext(
    nocturneSigner,
    prover,
    handler.provider,
    handler.address,
    merkleProver,
    notesManager,
    notesDB
  );
}

export async function setup(): Promise<NocturneSetup> {
  await deployments.fixture(["NocturneContracts"]);
  const vault = await ethers.getContract("Vault");
  const handler = await ethers.getContract("Handler");
  const wallet = await ethers.getContract("Wallet");
  const joinSplitVerifier = await ethers.getContract("JoinSplitVerifier");
  const subtreeUpdateVerifier = await ethers.getContract(
    "SubtreeUpdateVerifier"
  );

  // TODO: pass in proxy admin (currently deploys new one but we don't keep
  // track of this info)
  await handler.initialize(
    wallet.address,
    vault.address,
    joinSplitVerifier.address,
    subtreeUpdateVerifier.address
  );
  await wallet.initialize(handler.address, joinSplitVerifier.address);
  await vault.initialize(handler.address);
  const [_, alice, bob] = await ethers.getSigners();

  console.log("Create NocturneContextAlice");
  const aliceKV = new InMemoryKVStore();
  const notesDBAlice = new NotesDB(aliceKV);
  const merkleDBAlice = new MerkleDB(aliceKV);
  const nocturneContextAlice = setupNocturneContext(
    3n,
    handler,
    notesDBAlice,
    merkleDBAlice
  );

  console.log("Create NocturneContextBob");
  const bobKV = new InMemoryKVStore();
  const notesDBBob = new NotesDB(bobKV);
  const merkleDBBob = new MerkleDB(bobKV);
  const nocturneContextBob = setupNocturneContext(
    5n,
    handler,
    notesDBBob,
    merkleDBBob
  );

  return {
    alice,
    bob,
    vault,
    wallet,
    handler,
    notesDBAlice,
    merkleDBAlice,
    nocturneContextAlice,
    notesDBBob,
    merkleDBBob,
    nocturneContextBob,
  };
}

function getSubtreeUpdateContractFactory(): ethers.ContractFactory {
  if (process.env.ACTUALLY_PROVE_SUBTREE_UPDATE === "true") {
    return SubtreeUpdateVerifier__factory;
  }

  return TestSubtreeUpdateVerifier__factory;
}

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  // @ts-ignore
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;

  const { owner } = await getNamedAccounts();

  await deploy("Vault", {
    from: owner,
    contract: {
      abi: Vault__factory.abi,
      bytecode: Vault__factory.bytecode,
    },
    proxy: {
      proxyContract: TransparentUpgradeableProxy__factory,
    },
    log: true,
    deterministicDeployment: true,
  });

  await deploy("JoinSplitVerifier", {
    from: owner,
    contract: {
      abi: JoinSplitVerifier__factory.abi,
      bytecode: JoinSplitVerifier__factory.bytecode,
    },
    log: true,
    deterministicDeployment: true,
  });

  const subtreeUpdateVerifierFactory = getSubtreeUpdateContractFactory();
  await deploy("SubtreeUpdateVerifier", {
    from: owner,
    contract: {
      abi: subtreeUpdateVerifierFactory.abi,
      bytecode: subtreeUpdateVerifierFactory.bytecode,
    },
    log: true,
    deterministicDeployment: true,
  });

  await deploy("Handler", {
    from: owner,
    contract: {
      abi: Handler__factory.abi,
      bytecode: Handler__factory.bytecode,
    },
    proxy: {
      proxyContract: TransparentUpgradeableProxy__factory,
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
    proxy: {
      proxyContract: TransparentUpgradeableProxy__factory,
    },
    log: true,
    deterministicDeployment: true,
  });
};

export default func;
func.tags = ["NocturneContracts"];
