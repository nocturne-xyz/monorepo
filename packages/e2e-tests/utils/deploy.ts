import { ethers } from "hardhat";
import * as fs from "fs";
import {
  Wallet__factory,
  Vault__factory,
  Vault,
  Wallet,
} from "@nocturne-xyz/contracts";

import {
  NocturnePrivKey,
  NocturneSigner,
  NocturneContext,
  InMemoryKVStore,
  NotesDB,
  MerkleDB,
  DefaultMerkleProver,
  LocalNotesManager,
} from "@nocturne-xyz/sdk";
import { WasmJoinSplitProver } from "@nocturne-xyz/local-prover";

import {
  checkNocturneDeploymentConfig,
  NocturneDeployer,
} from "@nocturne-xyz/deploy";

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
  notesDBAlice: NotesDB;
  merkleDBAlice: MerkleDB;
  nocturneContextAlice: NocturneContext;
  notesDBBob: NotesDB;
  merkleDBBob: MerkleDB;
  nocturneContextBob: NocturneContext;
}

export async function setupNocturne(
  signer: ethers.Signer
): Promise<NocturneSetup> {
  const deployer = new NocturneDeployer(signer);
  const deployment = await deployer.deployNocturne(
    "0x3CACa7b48D0573D793d3b0279b5F0029180E83b6", // dummy
    {
      useMockSubtreeUpdateVerifier:
        process.env.ACTUALLY_PROVE_SUBTREE_UPDATE == undefined,
      provider: ethers.provider,
    }
  );

  await checkNocturneDeploymentConfig(deployment, ethers.provider);

  const { walletProxy, vaultProxy } = deployment;
  const wallet = Wallet__factory.connect(walletProxy.proxy, signer);
  const vault = Vault__factory.connect(vaultProxy.proxy, signer);

  const [_, alice, bob] = await ethers.getSigners();

  console.log("Create NocturneContextAlice");
  const aliceKV = new InMemoryKVStore();
  const notesDBAlice = new NotesDB(aliceKV);
  const merkleDBAlice = new MerkleDB(aliceKV);
  const nocturneContextAlice = setupNocturneContext(
    3n,
    wallet,
    notesDBAlice,
    merkleDBAlice
  );

  console.log("Create NocturneContextBob");
  const bobKV = new InMemoryKVStore();
  const notesDBBob = new NotesDB(bobKV);
  const merkleDBBob = new MerkleDB(bobKV);
  const nocturneContextBob = setupNocturneContext(
    5n,
    wallet,
    notesDBBob,
    merkleDBBob
  );

  console.log("Wallet address:", wallet.address);
  console.log("Vault address:", vault.address);
  return {
    alice,
    bob,
    vault,
    wallet,
    notesDBAlice,
    merkleDBAlice,
    nocturneContextAlice,
    notesDBBob,
    merkleDBBob,
    nocturneContextBob,
  };
}

function setupNocturneContext(
  sk: bigint,
  wallet: any,
  notesDB: NotesDB,
  merkleDB: MerkleDB
): NocturneContext {
  const nocturnePrivKey = new NocturnePrivKey(sk);
  const nocturneSigner = new NocturneSigner(nocturnePrivKey);

  const prover = new LocalJoinSplitProver(WASM_PATH, ZKEY_PATH, VKEY);
  const merkleProver = new LocalMerkleProver(
    wallet.address,
    ethers.provider,
    merkleDB
  );

  const notesManager = new LocalNotesManager(
    notesDB,
    nocturneSigner,
    wallet.address,
    ethers.provider
  );
  return new NocturneContext(
    nocturneSigner,
    prover,
    wallet.provider,
    wallet.address,
    merkleProver,
    notesManager,
    notesDB
  );
}
