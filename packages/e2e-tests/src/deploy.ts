import { ethers } from "ethers";
import * as fs from "fs";
import {
  Wallet__factory,
  Vault__factory,
  Vault,
  Wallet,
} from "@nocturne-xyz/contracts";

import {
  NocturneSigner,
  NocturneWalletSDK,
  InMemoryKVStore,
  NocturneDB,
  InMemoryMerkleProver,
  JoinSplitProver,
  RPCSyncAdapter,
} from "@nocturne-xyz/sdk";

import {
  checkNocturneContractDeployment,
  NocturneDeployer,
} from "@nocturne-xyz/deploy";

import findWorkspaceRoot from "find-yarn-workspace-root";
import * as path from "path";
import { WasmJoinSplitProver } from "@nocturne-xyz/local-prover";
import { NocturneConfig } from "@nocturne-xyz/config";

// eslint-disable-next-line
const ROOT_DIR = findWorkspaceRoot()!;
const ARTIFACTS_DIR = path.join(ROOT_DIR, "circuit-artifacts");
const WASM_PATH = `${ARTIFACTS_DIR}/joinsplit/joinsplit_js/joinsplit.wasm`;
const ZKEY_PATH = `${ARTIFACTS_DIR}/joinsplit/joinsplit_cpp/joinsplit.zkey`;
const VKEY_PATH = `${ARTIFACTS_DIR}/joinsplit/joinsplit_cpp/vkey.json`;
const VKEY = JSON.parse(fs.readFileSync(VKEY_PATH).toString());

export interface NocturneSetup {
  vault: Vault;
  wallet: Wallet;
  nocturneDBAlice: NocturneDB;
  nocturneWalletSDKAlice: NocturneWalletSDK;
  nocturneDBBob: NocturneDB;
  nocturneWalletSDKBob: NocturneWalletSDK;
  joinSplitProver: JoinSplitProver;
}

export async function setupNocturne(
  connectedSigner: ethers.Wallet
): Promise<NocturneSetup> {
  if (!connectedSigner.provider) {
    throw new Error("Signer must be connected");
  }

  const deployer = new NocturneDeployer(connectedSigner);
  const deployment = await deployer.deployNocturne(
    "0x3CACa7b48D0573D793d3b0279b5F0029180E83b6", // dummy
    {
      useMockSubtreeUpdateVerifier:
        process.env.ACTUALLY_PROVE_SUBTREE_UPDATE == undefined,
      confirmations: 1,
    }
  );

  await checkNocturneContractDeployment(deployment, connectedSigner.provider);
  const config = new NocturneConfig(
    deployment,
    // TODO: fill with real assets and rate limits in SDK gas asset and deposit
    // screener PRs
    new Map(Object.entries({})),
    new Map(Object.entries({}))
  );

  const { walletProxy, vaultProxy } = deployment;
  const wallet = Wallet__factory.connect(walletProxy.proxy, connectedSigner);
  const vault = Vault__factory.connect(vaultProxy.proxy, connectedSigner);

  console.log("Create NocturneWalletSDKAlice");
  const aliceKV = new InMemoryKVStore();
  const nocturneDBAlice = new NocturneDB(aliceKV);
  const nocturneWalletSDKAlice = setupNocturneWalletSDK(
    3n,
    config,
    connectedSigner.provider,
    nocturneDBAlice
  );

  console.log("Create NocturneWalletSDKBob");
  const bobKV = new InMemoryKVStore();
  const nocturneDBBob = new NocturneDB(bobKV);
  const nocturneWalletSDKBob = setupNocturneWalletSDK(
    5n,
    config,
    connectedSigner.provider,
    nocturneDBBob
  );

  const joinSplitProver = new WasmJoinSplitProver(WASM_PATH, ZKEY_PATH, VKEY);

  console.log("Wallet address:", wallet.address);
  console.log("Vault address:", vault.address);
  return {
    vault,
    wallet,
    nocturneDBAlice,
    nocturneWalletSDKAlice,
    nocturneDBBob,
    nocturneWalletSDKBob,
    joinSplitProver,
  };
}

function setupNocturneWalletSDK(
  sk: bigint,
  config: NocturneConfig,
  provider: ethers.providers.Provider,
  nocturneDB: NocturneDB
): NocturneWalletSDK {
  const walletAddress = config.walletAddress();
  const nocturneSigner = new NocturneSigner(sk);

  const merkleProver = new InMemoryMerkleProver();

  const syncAdapter = new RPCSyncAdapter(provider, walletAddress);

  return new NocturneWalletSDK(
    nocturneSigner,
    provider,
    config,
    merkleProver,
    nocturneDB,
    syncAdapter
  );
}
