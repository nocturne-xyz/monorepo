import { SimpleERC20Token } from "@nocturne-xyz/contracts/dist/src/SimpleERC20Token";
import {
  NocturneAddress,
  NoteTrait,
  SubtreeUpdateProver,
  MockSubtreeUpdateProver,
  encodeAsset,
  AssetType,
  InMemoryKVStore,
  NotesDB,
  MerkleDB,
  NocturneContext,
  NocturnePrivKey,
  NocturneSigner,
  LocalMerkleProver,
  LocalNotesManager,
} from "@nocturne-xyz/sdk";
import { RapidsnarkSubtreeUpdateProver } from "@nocturne-xyz/subtree-updater";
import { Vault, Wallet } from "@nocturne-xyz/contracts";
import {
  LocalJoinSplitProver,
  LocalSubtreeUpdateProver,
} from "@nocturne-xyz/local-prover";
import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import findWorkspaceRoot from "find-yarn-workspace-root";

const MOCK_SUBTREE_UPDATER_DELAY = 2100;

const ROOT_DIR = findWorkspaceRoot()!;
const EXECUTABLE_CMD = `${ROOT_DIR}/rapidsnark/build/prover`;
const ARTIFACTS_DIR = path.join(ROOT_DIR, "circuit-artifacts");

const JOINSPLIT_WASM_PATH = `${ARTIFACTS_DIR}/joinsplit/joinsplit_js/joinsplit.wasm`;
const JOINSPLIT_ZKEY_PATH = `${ARTIFACTS_DIR}/joinsplit/joinsplit_cpp/joinsplit.zkey`;
const JOINSPLIT_VKEY_PATH = `${ARTIFACTS_DIR}/joinsplit/joinsplit_cpp/vkey.json`;
const JOINSPLIT_VKEY = JSON.parse(
  fs.readFileSync(JOINSPLIT_VKEY_PATH).toString()
);

const SUBTREE_UPDATE_WASM_PATH = `${ARTIFACTS_DIR}/subtreeupdate/subtreeupdate_js/subtreeupdate.wasm`;
const WITNESS_GEN_EXECUTABLE_PATH = `${ARTIFACTS_DIR}/subtreeupdate/subtreeupdate_cpp/subtreeupdate`;
const SUBTREE_UPDATE_ZKEY_PATH = `${ARTIFACTS_DIR}/subtreeupdate/subtreeupdate_cpp/subtreeupdate.zkey`;
const SUBTREE_UPDATE_TMP_PATH = `${ARTIFACTS_DIR}/subtreeupdate/`;
const SUBTREE_UPDATE_VKEY_PATH = `${ARTIFACTS_DIR}/subtreeupdate/subtreeupdate_cpp/vkey.json`;

interface AliceAndBob {
  alice: ethers.Signer;
  bob: ethers.Signer;
  notesDBAlice: NotesDB;
  merkleDBAlice: MerkleDB;
  nocturneContextAlice: NocturneContext;
  notesDBBob: NotesDB;
  merkleDBBob: MerkleDB;
  nocturneContextBob: NocturneContext;
}

export async function setupAliceAndBob(wallet: Wallet): Promise<AliceAndBob> {
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

  return {
    alice,
    bob,
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

  const prover = new LocalJoinSplitProver(
    JOINSPLIT_WASM_PATH,
    JOINSPLIT_ZKEY_PATH,
    JOINSPLIT_VKEY
  );
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

export async function depositFunds(
  wallet: Wallet,
  vault: Vault,
  token: SimpleERC20Token,
  eoa: ethers.Signer,
  nocturneAddress: NocturneAddress,
  amounts: bigint[],
  startNonce = 0
): Promise<bigint[]> {
  const total = amounts.reduce((sum, a) => sum + a);
  token.reserveTokens(eoa.address, total);
  await token.connect(eoa).approve(vault.address, total);

  const asset = {
    assetType: AssetType.ERC20,
    assetAddr: token.address,
    id: 0n,
  };

  const { encodedAssetAddr, encodedAssetId } = encodeAsset(asset);

  const commitments = [];
  for (let i = 0; i < amounts.length; i++) {
    await wallet.connect(eoa).depositFunds({
      spender: eoa.address as string,
      encodedAssetAddr,
      encodedAssetId,
      value: amounts[i],
      depositAddr: nocturneAddress,
    });

    const note = {
      owner: nocturneAddress,
      nonce: BigInt(i + startNonce),
      asset,
      value: amounts[i],
    };
    commitments.push(NoteTrait.toCommitment(note));
  }

  return commitments;
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getSubtreeUpdateProver(): SubtreeUpdateProver {
  if (
    process.env.ACTUALLY_PROVE_SUBTREE_UPDATE === "true" &&
    process.env.USE_RAPIDSNARK === "true"
  ) {
    return new RapidsnarkSubtreeUpdateProver(
      EXECUTABLE_CMD,
      WITNESS_GEN_EXECUTABLE_PATH,
      SUBTREE_UPDATE_ZKEY_PATH,
      SUBTREE_UPDATE_VKEY_PATH,
      SUBTREE_UPDATE_TMP_PATH
    );
  } else if (process.env.ACTUALLY_PROVE_SUBTREE_UPDATE === "true") {
    const VKEY = JSON.parse(
      fs.readFileSync(SUBTREE_UPDATE_VKEY_PATH).toString()
    );
    return new LocalSubtreeUpdateProver(
      SUBTREE_UPDATE_WASM_PATH,
      SUBTREE_UPDATE_ZKEY_PATH,
      VKEY
    );
  }

  return new MockSubtreeUpdateProver();
}

export function getSubtreeUpdaterDelay(): number {
  if (
    process.env.ACTUALLY_PROVE_SUBTREE_UPDATE === "true" &&
    process.env.USE_RAPIDSNARK === "true"
  ) {
    return MOCK_SUBTREE_UPDATER_DELAY + 8000;
  } else if (process.env.ACTUALLY_PROVE_SUBTREE_UPDATE === "true") {
    return MOCK_SUBTREE_UPDATER_DELAY + 60000;
  }

  return MOCK_SUBTREE_UPDATER_DELAY;
}
