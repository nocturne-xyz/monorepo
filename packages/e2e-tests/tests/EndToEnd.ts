// import { expect } from "chai";
// import { ethers, network, config } from "hardhat";
// import { open } from "lmdb";
// import {
//   SimpleERC20Token__factory,
//   SimpleERC721Token__factory,
//   SimpleERC1155Token__factory,
//   Vault,
//   Wallet,
// } from "@nocturne-xyz/contracts";
// import { SimpleERC20Token } from "@nocturne-xyz/contracts/dist/src/SimpleERC20Token";
// import { SimpleERC721Token } from "@nocturne-xyz/contracts/dist/src/SimpleERC721Token";
// import { SimpleERC1155Token } from "@nocturne-xyz/contracts/dist/src/SimpleERC1155Token";

// import {
//   Action,
//   NocturneContext,
//   Asset,
//   JoinSplitRequest,
//   OperationRequest,
//   NotesDB,
//   query,
//   computeOperationDigest,
//   AssetType,
// } from "@nocturne-xyz/sdk";
import { setupNocturne } from "../src/deploy";
// import { depositFunds, sleep, getSubtreeUpdateProver } from "../utils/test";
// import { OperationProcessedEvent } from "@nocturne-xyz/contracts/dist/src/Wallet";
// import { SubtreeUpdater } from "@nocturne-xyz/subtree-updater";
// import RedisMemoryServer from "redis-memory-server";
// import {
//   BundlerBatcher,
//   BundlerServer,
//   BundlerSubmitter,
// } from "@nocturne-xyz/bundler";
// import IORedis from "ioredis";
// import * as JSON from "bigint-json-serialization";
// import fetch from "node-fetch";
// import http from "http";
// import { SyncSubtreeSubmitter } from "@nocturne-xyz/subtree-updater/dist/src/submitter";
import { ACTORS_TO_WALLETS, KEY_LIST } from "../src/keys";
import { startHardhatNetwork } from "../src/network";
import Dockerode from "dockerode";
import { ethers } from "ethers";
import { Vault, Wallet } from "@nocturne-xyz/contracts";
import { SimpleERC20Token } from "@nocturne-xyz/contracts/dist/src/SimpleERC20Token";
import { SimpleERC721Token } from "@nocturne-xyz/contracts/dist/src/SimpleERC721Token";
import { SimpleERC1155Token } from "@nocturne-xyz/contracts/dist/src/SimpleERC1155Token";
import { NocturneContext, NotesDB } from "@nocturne-xyz/sdk";

// const BUNDLER_SERVER_PORT = 3000;
// const BUNDLER_BATCHER_MAX_BATCH_LATENCY_SECS = 5;
// const BUNDLER_BATCH_SIZE = 2;

// const accounts = config.networks.hardhat.accounts;
// const BUNDLER_PRIVKEY = ethers.Wallet.fromMnemonic(
//   accounts.mnemonic,
//   accounts.path + `/${1}`
// ).privateKey;

// ALICE_UNWRAP_VAL + ALICE_TO_BOB_PRIV_VAL should be between PER_NOTE_AMOUNT
// and and 2 * PER_NOTE_AMOUNT
// const PER_NOTE_AMOUNT = 100n * 1_000_000n;
// const ALICE_UNWRAP_VAL = 120n * 1_000_000n;
// const ALICE_TO_BOB_PUB_VAL = 100n * 1_000_000n;
// const ALICE_TO_BOB_PRIV_VAL = 30n * 1_000_000n;

// const ERC20_TOKEN_ID = 0n;
// const ERC721_TOKEN_ID = 1n;
// const ERC1155_TOKEN_ID = 2n;
// const ERC1155_TOKEN_AMOUNT = 3n;

const LOCALHOST_URL = "http://localhost:8545";

describe("Wallet, Context, Bundler, and SubtreeUpdater", async () => {
  let docker: Dockerode;
  let hhContainer: Dockerode.Container;
  let provider: ethers.providers.JsonRpcProvider;
  let alice: ethers.Signer;
  let bob: ethers.Signer;
  let vault: Vault;
  let wallet: Wallet;
  let erc20Token: SimpleERC20Token;
  let erc721Token: SimpleERC721Token;
  let erc1155Token: SimpleERC1155Token;
  let notesDBAlice: NotesDB;
  let nocturneContextAlice: NocturneContext;
  let notesDBBob: NotesDB;
  let nocturneContextBob: NocturneContext;

  beforeEach(async () => {
    docker = new Dockerode();

    hhContainer = await startHardhatNetwork(docker, {
      blockTime: 1000,
      keys: KEY_LIST(),
    });

    provider = new ethers.providers.JsonRpcProvider(LOCALHOST_URL);
    const deployer = ACTORS_TO_WALLETS(provider).deployer;
    ({
      alice,
      bob,
      vault,
      wallet,
      notesDBAlice,
      nocturneContextAlice,
      notesDBBob,
      nocturneContextBob,
    } = await setupNocturne(deployer));
    console.log("Wallet:", wallet.address);
    console.log("Vault:", vault.address);

    alice;
    bob;
    erc20Token;
    erc721Token;
    erc1155Token;
    notesDBAlice;
    nocturneContextAlice;
    notesDBBob;
    nocturneContextBob;
  });

  after(async () => {
    await hhContainer.stop();
    await hhContainer.remove();
  });

  it("Runs", async () => {});
});
