import { expect } from "chai";
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
import * as JSON from "bigint-json-serialization";
// import fetch from "node-fetch";
// import http from "http";
// import { SyncSubtreeSubmitter } from "@nocturne-xyz/subtree-updater/dist/src/submitter";
import { ACTORS_TO_KEYS, ACTORS_TO_WALLETS, KEY_LIST } from "../src/keys";
import { startHardhatNetwork } from "../src/hardhat";
import Dockerode from "dockerode";
import * as compose from "docker-compose";
import { ethers } from "ethers";
import {
  SimpleERC20Token__factory,
  Vault,
  Wallet,
} from "@nocturne-xyz/contracts";
import { SimpleERC20Token } from "@nocturne-xyz/contracts/dist/src/SimpleERC20Token";
import { SimpleERC721Token } from "@nocturne-xyz/contracts/dist/src/SimpleERC721Token";
import { SimpleERC1155Token } from "@nocturne-xyz/contracts/dist/src/SimpleERC1155Token";
import {
  Action,
  Asset,
  AssetType,
  computeOperationDigest,
  JoinSplitRequest,
  NocturneContext,
  NotesDB,
  OperationRequest,
  query,
} from "@nocturne-xyz/sdk";
import { startSubtreeUpdater } from "../src/subtreeUpdater";
import { sleep } from "../src/utils";
import { BUNDLER_COMPOSE_OPTS, startBundler } from "../src/bundler";
import { depositErc20 } from "../src/deposit";
import { OperationProcessedEvent } from "@nocturne-xyz/contracts/dist/src/Wallet";

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
const PER_NOTE_AMOUNT = 100n * 1_000_000n;
const ALICE_UNWRAP_VAL = 120n * 1_000_000n;
const ALICE_TO_BOB_PUB_VAL = 100n * 1_000_000n;
const ALICE_TO_BOB_PRIV_VAL = 30n * 1_000_000n;

const ERC20_TOKEN_ID = 0n;
// const ERC721_TOKEN_ID = 1n;
// const ERC1155_TOKEN_ID = 2n;
// const ERC1155_TOKEN_AMOUNT = 3n;

const HH_URL = "http://localhost:8545";
const HH_FROM_DOCKER_URL = "http://host.docker.internal:8545";

const REDIS_URL = "redis://redis:6379";
const REDIS_PASSWORD = "baka";

describe("Wallet, Context, Bundler, and SubtreeUpdater", async () => {
  let docker: Dockerode;
  let hhContainer: Dockerode.Container;
  let subtreeUpdaterContainer: Dockerode.Container;
  let provider: ethers.providers.JsonRpcProvider;
  let aliceEoa: ethers.Signer;
  let bobEoa: ethers.Signer;
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

    provider = new ethers.providers.JsonRpcProvider(HH_URL);
    const deployer = ACTORS_TO_WALLETS(provider).deployer;
    ({
      aliceEoa,
      bobEoa,
      vault,
      wallet,
      notesDBAlice,
      nocturneContextAlice,
      notesDBBob,
      nocturneContextBob,
    } = await setupNocturne(deployer));

    const tokenFactory = new SimpleERC20Token__factory(deployer);
    erc20Token = await tokenFactory.deploy();
    console.log("ERC20 erc20Token deployed at: ", erc20Token.address);

    console.log("Wallet:", wallet.address);
    console.log("Vault:", vault.address);

    subtreeUpdaterContainer = await startSubtreeUpdater(docker, {
      walletAddress: wallet.address,
      rpcUrl: HH_FROM_DOCKER_URL,
      txSignerKey: ACTORS_TO_KEYS.subtreeUpdater,
    });
    subtreeUpdaterContainer;

    await startBundler({
      redisUrl: REDIS_URL,
      redisPassword: REDIS_PASSWORD,
      walletAddress: wallet.address,
      maxLatency: 1,
      rpcUrl: HH_FROM_DOCKER_URL,
      txSignerKey: ACTORS_TO_KEYS.bundler,
    });

    aliceEoa;
    bobEoa;
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

    await subtreeUpdaterContainer.stop();
    await subtreeUpdaterContainer.remove();

    await compose.down(BUNDLER_COMPOSE_OPTS);
    await compose.kill(BUNDLER_COMPOSE_OPTS);
  });

  async function testE2E(
    joinSplitRequests: JoinSplitRequest[],
    refundAssets: Asset[],
    actions: Action[],
    contractChecks: () => Promise<void>,
    offchainChecks: () => Promise<void>
  ): Promise<void> {
    console.log("Alice: Sync SDK notes manager");
    await nocturneContextAlice.syncNotes();

    console.log("Bob: Sync SDK notes manager");
    await nocturneContextBob.syncNotes();

    const preOpNotesAlice = await notesDBAlice.getAllNotes();
    console.log("Alice pre-op notes:", preOpNotesAlice);

    console.log("Alice: Sync SDK merkle prover");
    await nocturneContextAlice.syncLeaves();

    console.log("Bob: Sync SDK merkle prover");
    await nocturneContextBob.syncLeaves();

    const operationRequest: OperationRequest = {
      joinSplitRequests,
      refundAssets,
      actions,
      gasPrice: 0n,
    };

    console.log("Create post-proof operation with NocturneContext");
    const operation = await nocturneContextAlice.tryCreateProvenOperation(
      operationRequest
    );

    console.log("Process bundle");
    var res = await fetch(`http://localhost:3000/relay`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(operation),
    });
    console.log("Bundler server response: ", await res.json());

    console.log("Sleeping for 30s while bundler submits...");
    await sleep(30_000);

    const operationDigest = computeOperationDigest(operation);
    var res = await fetch(
      `http://localhost:3000/operations/${operationDigest}`,
      {
        method: "GET",
      }
    );
    console.log(
      `Bundler marked operation ${operationDigest} ${JSON.stringify(
        await res.json()
      )}`
    );

    await contractChecks();
    await offchainChecks();
  }

  it("Runs", async () => {
    console.log("Deposit funds and commit note commitments");
    await depositErc20(
      wallet,
      vault,
      erc20Token,
      aliceEoa,
      nocturneContextAlice.signer.address,
      [PER_NOTE_AMOUNT, PER_NOTE_AMOUNT]
    );
    await sleep(10_000);

    const erc20Asset: Asset = {
      assetType: AssetType.ERC20,
      assetAddr: erc20Token.address,
      id: ERC20_TOKEN_ID,
    };

    const joinSplitRequest: JoinSplitRequest = {
      asset: erc20Asset,
      unwrapValue: ALICE_UNWRAP_VAL,
      paymentIntent: {
        receiver: nocturneContextBob.signer.canonAddress,
        value: ALICE_TO_BOB_PRIV_VAL,
      },
    };

    console.log("Encode transfer erc20 action");
    const encodedFunction =
      SimpleERC20Token__factory.createInterface().encodeFunctionData(
        "transfer",
        [await bobEoa.getAddress(), ALICE_TO_BOB_PUB_VAL]
      );
    const transferAction: Action = {
      contractAddress: erc20Token.address,
      encodedFunction: encodedFunction,
    };

    const contractChecks = async () => {
      console.log("Check for OperationProcessed event");
      const latestBlock = await provider.getBlockNumber();
      const events: OperationProcessedEvent[] = await query(
        wallet,
        wallet.filters.OperationProcessed(),
        0,
        latestBlock
      );
      expect(events.length).to.equal(1);
      expect(events[0].args.opProcessed).to.equal(true);
      expect(events[0].args.callSuccesses[0]).to.equal(true);

      expect(
        (await erc20Token.balanceOf(await aliceEoa.getAddress())).toBigInt()
      ).to.equal(0n);
      expect(
        (await erc20Token.balanceOf(await bobEoa.getAddress())).toBigInt()
      ).to.equal(ALICE_TO_BOB_PUB_VAL);
      expect((await erc20Token.balanceOf(vault.address)).toBigInt()).to.equal(
        2n * PER_NOTE_AMOUNT - ALICE_TO_BOB_PUB_VAL
      );
    };

    const offchainChecks = async () => {
      console.log("Alice: Sync SDK notes manager post-operation");
      await nocturneContextAlice.syncNotes();
      const updatedNotesAlice = await notesDBAlice.getNotesFor(erc20Asset)!;
      const nonZeroNotesAlice = updatedNotesAlice.filter((n) => n.value > 0n);
      // alice should have two nonzero notes total
      expect(nonZeroNotesAlice.length).to.equal(2);
      console.log("Alice post-op notes:", nonZeroNotesAlice);

      // alice should have a note with refund value from public spendk
      let foundNotesAlice = nonZeroNotesAlice.filter(
        (n) => n.value === ALICE_UNWRAP_VAL - ALICE_TO_BOB_PUB_VAL
      );
      expect(foundNotesAlice.length).to.equal(1);

      // alice should have another note with refund value from private payment to bob
      foundNotesAlice = nonZeroNotesAlice.filter(
        (n) =>
          n.value ===
          2n * PER_NOTE_AMOUNT - ALICE_UNWRAP_VAL - ALICE_TO_BOB_PRIV_VAL
      );
      expect(foundNotesAlice.length).to.equal(1);

      console.log("Bob: Sync SDK notes manager post-operation");
      await nocturneContextBob.syncNotes();
      const updatedNotesBob = await notesDBBob.getNotesFor(erc20Asset)!;
      const nonZeroNotesBob = updatedNotesBob.filter((n) => n.value > 0n);
      // bob should have one nonzero note total
      expect(nonZeroNotesBob.length).to.equal(1);

      // That one note should contain the tokens sent privately from alice
      expect(nonZeroNotesBob[0].value).to.equal(ALICE_TO_BOB_PRIV_VAL);
    };

    await testE2E(
      [joinSplitRequest],
      [],
      [transferAction],
      contractChecks,
      offchainChecks
    );
  });
});
