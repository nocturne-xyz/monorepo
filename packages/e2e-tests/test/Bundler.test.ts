import { expect } from "chai";
import { ethers, network } from "hardhat";
import { open } from "lmdb";
import {
  SimpleERC20Token__factory,
  Vault,
  Wallet,
} from "@nocturne-xyz/contracts";
import { SimpleERC20Token } from "@nocturne-xyz/contracts/dist/src/SimpleERC20Token";

import {
  Action,
  SNARK_SCALAR_FIELD,
  NocturneContext,
  Asset,
  AssetRequest,
  OperationRequest,
  LocalObjectDB,
  LocalMerkleProver,
  MockSubtreeUpdateProver,
  query,
} from "@nocturne-xyz/sdk";
import {
  BundlerServer,
  BundlerBatcher,
  BundlerSubmitter,
} from "@nocturne-xyz/bundler";
import { setup } from "../deploy/deployNocturne";
import { depositFunds, pipeEnvVars } from "./utils";
import { OperationProcessedEvent } from "@nocturne-xyz/contracts/dist/src/Wallet";
import { SubtreeUpdater } from "@nocturne-xyz/subtree-updater";
import IORedis from "ioredis";
import { RedisMemoryServer } from "redis-memory-server";
import fetch from "node-fetch";
import * as JSON from "bigint-json-serialization";

const BUNDLER_SERVER_PORT = 3000;
const BUNDLER_BATCHER_MAX_SECONDS = 10;
const BUNDLER_BATCH_SIZE = 8;

const ERC20_ID = SNARK_SCALAR_FIELD - 1n;
const PER_SPEND_AMOUNT = 100n;

const BUNDLER_MNEUMONIC =
  "announce room limb pattern dry unit scale effort smooth jazz weasel alcohol";
const BUNDLER_PRIVKEY =
  ethers.Wallet.fromMnemonic(BUNDLER_MNEUMONIC).privateKey;

describe("Bundler", async () => {
  let deployer: ethers.Signer;
  let alice: ethers.Signer;
  let bob: ethers.Signer;
  let vault: Vault;
  let wallet: Wallet;
  let token: SimpleERC20Token;
  let nocturneContext: NocturneContext;
  let db: LocalObjectDB;
  let updater: SubtreeUpdater;
  let redisServer: RedisMemoryServer;
  let bundlerServer: BundlerServer;
  let bundlerBatcher: BundlerBatcher;
  let bundlerSubmitter: BundlerSubmitter;

  beforeEach(async () => {
    pipeEnvVars(
      ethers.provider.rpcUrl,
      BUNDLER_PRIVKEY,
      `localhost:${BUNDLER_SERVER_PORT}`
    );

    [deployer] = await ethers.getSigners();
    const tokenFactory = new SimpleERC20Token__factory(deployer);
    token = await tokenFactory.deploy();
    console.log("Token deployed at: ", token.address);

    const nocturneSetup = await setup();
    alice = nocturneSetup.alice;
    bob = nocturneSetup.bob;
    vault = nocturneSetup.vault;
    wallet = nocturneSetup.wallet;
    token = token;
    nocturneContext = nocturneSetup.nocturneContext;
    db = nocturneSetup.db;

    const serverDB = open({ path: `${__dirname}/../db/localMerkleTestDB` });
    const prover = new MockSubtreeUpdateProver();
    updater = new SubtreeUpdater(wallet, serverDB, prover);

    redisServer = await RedisMemoryServer.create();
    const host = await redisServer.getHost();
    const port = await redisServer.getPort();
    const redis = new IORedis(port, host);

    bundlerServer = new BundlerServer(wallet.address, redis);
    bundlerBatcher = new BundlerBatcher(
      BUNDLER_BATCHER_MAX_SECONDS,
      BUNDLER_BATCH_SIZE,
      redis
    );
    bundlerSubmitter = new BundlerSubmitter(wallet.address, redis);

    await updater.init();
    pipeEnvVars(
      ethers.provider.rpcUrl,
      BUNDLER_PRIVKEY,
      `localhost:${BUNDLER_SERVER_PORT}`
    );
  });

  async function applySubtreeUpdate() {
    await wallet.fillBatchWithZeros();
    await updater.pollInsertionsAndTryMakeBatch();
    await updater.tryGenAndSubmitProofs();
  }

  afterEach(async () => {
    await db.clear();
    await updater.dropDB();
  });

  after(async () => {
    await network.provider.send("hardhat_reset");
  });

  it("Alice deposits two 100 token notes, spends one and transfers 50 tokens to Bob", async () => {
    const bundlerServerProm = bundlerServer.run(BUNDLER_SERVER_PORT);
    const bundlerBatcherProm = bundlerBatcher.run();
    const bundlerSubmitterProm = bundlerSubmitter.run();

    const asset: Asset = { address: token.address, id: ERC20_ID };

    console.log("Deposit funds and commit note commitments");
    await depositFunds(
      wallet,
      vault,
      token,
      alice,
      nocturneContext.signer.address,
      [PER_SPEND_AMOUNT, PER_SPEND_AMOUNT]
    );

    console.log("apply subtree update");
    await applySubtreeUpdate();

    console.log("Sync SDK merkle prover");
    await nocturneContext.syncLeaves();
    expect((nocturneContext.merkleProver as LocalMerkleProver).root()).to.equal(
      (await wallet.root()).toBigInt()
    );

    console.log("Sync SDK notes manager");
    await nocturneContext.syncNotes();
    const notesForAsset = await nocturneContext.db.getNotesFor(asset);
    expect(notesForAsset.length).to.equal(2);

    console.log("Create asset request to spend 50 units of token");
    const assetRequest: AssetRequest = {
      asset,
      value: 50n,
    };

    console.log("Encode operation request");
    const refundTokens = [token.address];
    const encodedFunction =
      SimpleERC20Token__factory.createInterface().encodeFunctionData(
        "transfer",
        [bob.address, 50]
      );
    const action: Action = {
      contractAddress: token.address,
      encodedFunction: encodedFunction,
    };
    const operationRequest: OperationRequest = {
      assetRequests: [assetRequest],
      refundTokens,
      actions: [action],
    };

    console.log("Create post-proof operation with NocturneContext");
    const operation = await nocturneContext.tryCreateProvenOperation(
      operationRequest
    );

    console.log("Body to send: ", JSON.stringify(operation));
    console.log("Process bundle");
    var res = await fetch(`http://localhost:${BUNDLER_SERVER_PORT}/relay`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(operation),
    });
    console.log("RES: ", await res.json());

    console.log("Check for OperationProcessed event");
    const latestBlock = await ethers.provider.getBlockNumber();
    const events: OperationProcessedEvent[] = await query(
      wallet,
      wallet.filters.OperationProcessed(),
      0,
      latestBlock
    );
    expect(events.length).to.equal(1);
    expect(events[0].args.opSuccess).to.equal(true);
    expect(events[0].args.callSuccesses[0]).to.equal(true);

    expect((await token.balanceOf(alice.address)).toBigInt()).to.equal(800n);
    expect((await token.balanceOf(bob.address)).toBigInt()).to.equal(50n);
    expect((await token.balanceOf(vault.address)).toBigInt()).to.equal(150n);

    console.log("Sync SDK notes manager post-operation");
    await nocturneContext.syncNotes();
    const updatedNotesForAsset = await nocturneContext.db.getNotesFor(asset)!;
    const FoundNote = updatedNotesForAsset.filter((n) => n.value > 0);
    // There should be one new note of value 50n
    expect(FoundNote.length).to.equal(2);
    expect(FoundNote[1].value).to.equal(50n);
  });
});
