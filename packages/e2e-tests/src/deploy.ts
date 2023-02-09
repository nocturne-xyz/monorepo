import { ethers } from "ethers";
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
  InMemoryMerkleProver,
  DefaultNotesManager,
} from "@nocturne-xyz/sdk";

import {
  checkNocturneDeploymentConfig,
  NocturneDeployer,
} from "@nocturne-xyz/deploy";

export interface NocturneSetup {
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

  await checkNocturneDeploymentConfig(deployment, connectedSigner.provider);

  const { walletProxy, vaultProxy } = deployment;
  const wallet = Wallet__factory.connect(walletProxy.proxy, connectedSigner);
  const vault = Vault__factory.connect(vaultProxy.proxy, connectedSigner);

  console.log("Create NocturneContextAlice");
  const aliceKV = new InMemoryKVStore();
  const notesDBAlice = new NotesDB(aliceKV);
  const merkleDBAlice = new MerkleDB(aliceKV);
  const nocturneContextAlice = setupNocturneContext(
    3n,
    wallet,
    notesDBAlice,
    merkleDBAlice,
    connectedSigner.provider
  );

  console.log("Create NocturneContextBob");
  const bobKV = new InMemoryKVStore();
  const notesDBBob = new NotesDB(bobKV);
  const merkleDBBob = new MerkleDB(bobKV);
  const nocturneContextBob = setupNocturneContext(
    5n,
    wallet,
    notesDBBob,
    merkleDBBob,
    connectedSigner.provider
  );

  console.log("Wallet address:", wallet.address);
  console.log("Vault address:", vault.address);
  return {
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
  merkleDB: MerkleDB,
  provider: ethers.providers.Provider
): NocturneContext {
  const nocturnePrivKey = new NocturnePrivKey(sk);
  const nocturneSigner = new NocturneSigner(nocturnePrivKey);

  const merkleProver = new InMemoryMerkleProver(
    wallet.address,
    provider,
    merkleDB
  );

  const notesManager = new DefaultNotesManager(
    notesDB,
    nocturneSigner,
    wallet.address,
    provider
  );
  return new NocturneContext(
    nocturneSigner,
    wallet.provider,
    wallet.address,
    merkleProver,
    notesManager,
    notesDB
  );
}
