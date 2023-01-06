import { expect } from "chai";
import { ethers, network, config } from "hardhat";
import { open } from "lmdb";
import {
  SimpleERC20Token__factory,
  SimpleERC721Token__factory,
  SimpleERC1155Token__factory,
  Vault,
  Wallet,
} from "@nocturne-xyz/contracts";
import { SimpleERC20Token } from "@nocturne-xyz/contracts/dist/src/SimpleERC20Token";
import { SimpleERC721Token } from "@nocturne-xyz/contracts/dist/src/SimpleERC721Token";
import { SimpleERC1155Token } from "@nocturne-xyz/contracts/dist/src/SimpleERC1155Token";

import {
  Action,
  NocturneContext,
  Asset,
  JoinSplitRequest,
  OperationRequest,
  NotesDB,
  LocalMerkleProver,
  query,
  calculateOperationDigest,
  AssetType,
} from "@nocturne-xyz/sdk";
import { setup } from "../deploy/deployNocturne";
import { depositFunds, sleep, getSubtreeUpdateProver } from "./utils";
import { OperationProcessedEvent } from "@nocturne-xyz/contracts/dist/src/Wallet";
import { SubtreeUpdater } from "@nocturne-xyz/subtree-updater";
import RedisMemoryServer from "redis-memory-server";
import {
  BundlerBatcher,
  BundlerServer,
  BundlerSubmitter,
} from "@nocturne-xyz/bundler";
import IORedis from "ioredis";
import * as JSON from "bigint-json-serialization";
import fetch from "node-fetch";

const BUNDLER_SERVER_PORT = 3000;
const BUNDLER_BATCHER_MAX_BATCH_LATENCY_SECS = 5;
const BUNDLER_BATCH_SIZE = 2;

const accounts = config.networks.hardhat.accounts;
const BUNDLER_PRIVKEY = ethers.Wallet.fromMnemonic(
  accounts.mnemonic,
  accounts.path + `/${1}`
).privateKey;

// ALICE_UNWRAP_VAL + ALICE_TO_BOB_PRIV_VAL should be between PER_NOTE_AMOUNT
// and and 2 * PER_NOTE_AMOUNT
const PER_NOTE_AMOUNT = 100n * 1_000_000n;
const ALICE_UNWRAP_VAL = 120n * 1_000_000n;
const ALICE_TO_BOB_PUB_VAL = 100n * 1_000_000n;
const ALICE_TO_BOB_PRIV_VAL = 30n * 1_000_000n;

const ERC721_TOKEN_ID = 1n;
const ERC1155_TOKEN_ID = 2n;
const ERC1155_TOKEN_AMOUNT = 3n;

describe("Wallet, Context, Bundler, and SubtreeUpdater", async () => {
  let deployer: ethers.Signer;
  let alice: ethers.Signer;
  let bob: ethers.Signer;
  let vault: Vault;
  let wallet: Wallet;
  let token: SimpleERC20Token;
  let erc721Token: SimpleERC721Token;
  let erc1155Token: SimpleERC1155Token;
  let updater: SubtreeUpdater;
  let notesDBAlice: NotesDB;
  let nocturneContextAlice: NocturneContext;
  let notesDBBob: NotesDB;
  let nocturneContextBob: NocturneContext;
  let redisServer: RedisMemoryServer;
  let bundlerServer: BundlerServer;
  let bundlerBatcher: BundlerBatcher;
  let bundlerSubmitter: BundlerSubmitter;

  beforeEach(async () => {
    [deployer] = await ethers.getSigners();
    const tokenFactory = new SimpleERC20Token__factory(deployer);
    token = await tokenFactory.deploy();
    console.log("Token deployed at: ", token.address);

    const erc721TokenFactory = new SimpleERC721Token__factory(deployer);
    erc721Token = await erc721TokenFactory.deploy();
    console.log("ERC721 token deployed at: ", erc721Token.address);

    const erc1155TokenFactory = new SimpleERC1155Token__factory(deployer);
    erc1155Token = await erc1155TokenFactory.deploy();
    console.log("ERC1155 token deployed at: ", erc1155Token.address);

    ({
      alice,
      bob,
      vault,
      wallet,
      notesDBAlice,
      nocturneContextAlice,
      notesDBBob,
      nocturneContextBob,
    } = await setup());

    const serverDB = open({ path: `${__dirname}/../db/localMerkleTestDB` });
    const prover = getSubtreeUpdateProver();
    updater = new SubtreeUpdater(wallet, serverDB, prover);

    redisServer = await RedisMemoryServer.create();
    const host = await redisServer.getHost();
    const port = await redisServer.getPort();
    const redis = new IORedis(port, host);

    bundlerServer = new BundlerServer(wallet.address, redis, ethers.provider);
    bundlerBatcher = new BundlerBatcher(
      BUNDLER_BATCHER_MAX_BATCH_LATENCY_SECS,
      BUNDLER_BATCH_SIZE,
      redis
    );

    process.env.TX_SIGNER_KEY = BUNDLER_PRIVKEY;
    const signingProvider = new ethers.Wallet(BUNDLER_PRIVKEY, ethers.provider);
    bundlerSubmitter = new BundlerSubmitter(
      wallet.address,
      redis,
      signingProvider
    );

    await updater.init();
  });

  async function applySubtreeUpdate() {
    await wallet.fillBatchWithZeros();
    await updater.pollInsertionsAndTryMakeBatch();
    await updater.tryGenAndSubmitProofs();
  }

  afterEach(async () => {
    await notesDBAlice.kv.clear();
    await notesDBBob.kv.clear();
    await updater.dropDB();
  });

  after(async () => {
    await network.provider.send("hardhat_reset");
  });

  it(`Alice deposits two ${PER_NOTE_AMOUNT} token notes, spends one and unwraps ${ALICE_UNWRAP_VAL} tokens publicly, ERC20 transfers ${ALICE_TO_BOB_PUB_VAL} to Bob, and pays ${ALICE_TO_BOB_PUB_VAL} to Bob privately`, async () => {
    console.log("Start bundler");
    bundlerServer.run(BUNDLER_SERVER_PORT).catch(console.error);
    const bundlerBatcherProm = bundlerBatcher.run().catch(console.error);
    const bundlerSubmitterProm = bundlerSubmitter.run().catch(console.error);

    const asset: Asset = {
      assetType: AssetType.ERC20,
      assetAddr: token.address,
      id: 0n,
    };

    const erc721Asset: Asset = {
      assetType: AssetType.ERC721,
      assetAddr: erc721Token.address,
      id: ERC721_TOKEN_ID,
    };

    const erc1155Asset: Asset = {
      assetType: AssetType.ERC1155,
      assetAddr: erc1155Token.address,
      id: ERC1155_TOKEN_ID,
    };

    console.log("Deposit funds and commit note commitments");
    await depositFunds(
      wallet,
      vault,
      token,
      alice,
      nocturneContextAlice.signer.address,
      [PER_NOTE_AMOUNT, PER_NOTE_AMOUNT]
    );

    console.log("apply subtree update");

    await applySubtreeUpdate();
    await (
      nocturneContextAlice.merkleProver as LocalMerkleProver
    ).fetchLeavesAndUpdate();

    console.log("Alice: Sync SDK notes manager");
    await nocturneContextAlice.syncNotes();
    const notesForAlice = await nocturneContextAlice.db.getNotesFor(asset);
    expect(notesForAlice.length).to.equal(2);

    console.log("Bob: Sync SDK notes manager");
    await nocturneContextBob.syncNotes();
    const notesForBob = await nocturneContextBob.db.getNotesFor(asset);
    expect(notesForBob.length).to.equal(0);

    console.log("Sync SDK merkle prover");
    await nocturneContextAlice.syncLeaves();
    expect(
      (nocturneContextAlice.merkleProver as LocalMerkleProver).root()
    ).to.equal((await wallet.root()).toBigInt());

    const joinSplitRequest: JoinSplitRequest = {
      asset,
      unwrapValue: ALICE_UNWRAP_VAL,
      paymentIntent: {
        receiver: nocturneContextBob.signer.canonAddress,
        value: ALICE_TO_BOB_PRIV_VAL,
      },
    };

    console.log("Encode operation request");
    const encodedFunction =
      SimpleERC20Token__factory.createInterface().encodeFunctionData(
        "transfer",
        [bob.address, ALICE_TO_BOB_PUB_VAL]
      );
    const action: Action = {
      contractAddress: token.address,
      encodedFunction: encodedFunction,
    };

    const erc721EncodedFunction =
      SimpleERC721Token__factory.createInterface().encodeFunctionData(
        "reserveToken",
        // mint NFT directly to the wallet contract
        [wallet.address, ERC721_TOKEN_ID]
      );
    const erc721Action: Action = {
      contractAddress: erc721Token.address,
      encodedFunction: erc721EncodedFunction,
    };

    const erc1155EncodedFunction =
      SimpleERC1155Token__factory.createInterface().encodeFunctionData(
        "reserveTokens",
        // mint NFT directly to the wallet contract
        [wallet.address, ERC1155_TOKEN_ID, ERC1155_TOKEN_AMOUNT]
      );
    const erc1155Action: Action = {
      contractAddress: erc1155Token.address,
      encodedFunction: erc1155EncodedFunction,
    };

    const operationRequest: OperationRequest = {
      joinSplitRequests: [joinSplitRequest],
      refundAssets: [],
      actions: [action, erc721Action, erc1155Action],
      gasPrice: 0n,
    };

    console.log("Create post-proof operation with NocturneContext");
    const operation = await nocturneContextAlice.tryCreateProvenOperation(
      operationRequest
    );

    console.log("Process bundle");
    var res = await fetch(`http://localhost:${BUNDLER_SERVER_PORT}/relay`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(operation),
    });
    console.log("Bundler server response: ", await res.json());

    console.log("Sleeping for 10s while bundler submits...");
    await Promise.race([
      sleep(10000),
      bundlerBatcherProm,
      bundlerSubmitterProm,
    ]);

    console.log("Ensure bundler marked operation EXECUTED_SUCCESS");
    const operationDigest = calculateOperationDigest(operation);
    var res = await fetch(
      `http://localhost:${BUNDLER_SERVER_PORT}/operations/${operationDigest}`,
      {
        method: "GET",
      }
    );
    expect(await res.json()).to.equal("EXECUTED_SUCCESS");

    console.log("Check for OperationProcessed event");
    const latestBlock = await ethers.provider.getBlockNumber();
    const events: OperationProcessedEvent[] = await query(
      wallet,
      wallet.filters.OperationProcessed(),
      0,
      latestBlock
    );
    expect(events.length).to.equal(1);
    expect(events[0].args.opProcessed).to.equal(true);
    expect(events[0].args.callSuccesses[0]).to.equal(true);

    expect((await token.balanceOf(alice.address)).toBigInt()).to.equal(0n);
    expect((await token.balanceOf(bob.address)).toBigInt()).to.equal(
      ALICE_TO_BOB_PUB_VAL
    );
    expect((await token.balanceOf(vault.address)).toBigInt()).to.equal(
      2n * PER_NOTE_AMOUNT - ALICE_TO_BOB_PUB_VAL
    );

    console.log("Alice: Sync SDK notes manager post-operation");
    await nocturneContextAlice.syncNotes();
    const updatedNotesAlice = await notesDBAlice.getNotesFor(asset)!;
    const nonZeroNotesAlice = updatedNotesAlice.filter((n) => n.value > 0n);
    // alcie should have two nonzero notes total
    expect(nonZeroNotesAlice.length).to.equal(2);

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

    // Alice should have a note for minted ERC721 token
    const erc721NotesAlice = await notesDBAlice.getNotesFor(erc721Asset)!;
    expect(erc721NotesAlice.length).to.equal(1);

    // Alice should have a note for minted ERC1155 token
    const erc1155NotesAlice = await notesDBAlice.getNotesFor(erc1155Asset)!;
    foundNotesAlice = erc1155NotesAlice.filter(
      (n) => n.value === ERC1155_TOKEN_AMOUNT
    );
    expect(erc1155NotesAlice.length).to.equal(1);

    console.log("Bob: Sync SDK notes manager post-operation");
    await nocturneContextBob.syncNotes();
    const updatedNotesBob = await notesDBBob.getNotesFor(asset)!;
    const nonZeroNotesBob = updatedNotesBob.filter((n) => n.value > 0n);
    // bob should have one nonzero note total
    expect(nonZeroNotesBob.length).to.equal(1);

    // That one note should contain the tokens sent privately from alice
    expect(nonZeroNotesBob[0].value).to.equal(ALICE_TO_BOB_PRIV_VAL);
  });
});
