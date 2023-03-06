import { expect } from "chai";
import { ethers } from "ethers";
import { open } from "lmdb";
import {
  SimpleERC20Token__factory,
  Vault,
  Wallet,
} from "@nocturne-xyz/contracts";
import * as compose from "docker-compose";
import { SubtreeUpdater } from "@nocturne-xyz/subtree-updater";
import {
  AssetType,
  JoinSplitProver,
  NocturneContext,
  OpProver,
  OperationRequestBuilder,
} from "@nocturne-xyz/sdk";
import { setupNocturne } from "../src/deploy";
import { depositFunds } from "../src/deposit";
import {
  getSubtreeUpdateProver,
  submitAndProcessOperation,
} from "../src/utils";
import { SimpleERC20Token } from "@nocturne-xyz/contracts/dist/src/SimpleERC20Token";
import { SyncSubtreeSubmitter } from "@nocturne-xyz/subtree-updater/dist/src/submitter";
import Dockerode from "dockerode";
import { KEYS, KEYS_TO_WALLETS } from "../src/keys";
import { startHardhatNetwork } from "../src/hardhat";
import { BUNDLER_COMPOSE_CWD, startBundler } from "../src/bundler";

const HH_URL = "http://localhost:8545";
const HH_FROM_DOCKER_URL = "http://host.docker.internal:8545";

const REDIS_URL = "redis://redis:6379";
const REDIS_PASSWORD = "baka";

describe("NocturneSyncer", async () => {
  let docker: Dockerode;
  let hhContainer: Dockerode.Container;

  let provider: ethers.providers.Provider;
  let deployerEoa: ethers.Wallet;
  let aliceEoa: ethers.Wallet;
  let bundlerEoa: ethers.Wallet;

  let wallet: Wallet;
  let vault: Vault;
  let token: SimpleERC20Token;
  let nocturneContextAlice: NocturneContext;
  let updater: SubtreeUpdater;
  let joinSplitProver: JoinSplitProver;
  let opProver: OpProver;

  beforeEach(async () => {
    docker = new Dockerode();
    hhContainer = await startHardhatNetwork(docker, {
      blockTime: 3_000,
      keys: KEYS,
    });

    provider = new ethers.providers.JsonRpcProvider(HH_URL);
    [deployerEoa, aliceEoa, bundlerEoa] = KEYS_TO_WALLETS(provider);
    ({ vault, wallet, nocturneContextAlice, joinSplitProver } =
      await setupNocturne(deployerEoa));

    opProver = new OpProver(joinSplitProver);

    const tokenFactory = new SimpleERC20Token__factory(deployerEoa);
    token = await tokenFactory.deploy();
    console.log("Token deployed at: ", token.address);
    await newSubtreeUpdater();

    await startBundler({
      redisUrl: REDIS_URL,
      redisPassword: REDIS_PASSWORD,
      walletAddress: wallet.address,
      maxLatency: 1,
      rpcUrl: HH_FROM_DOCKER_URL,
      txSignerKey: bundlerEoa.privateKey,
    });
  });

  async function newSubtreeUpdater() {
    const serverDB = open({ path: `${__dirname}/../db/merkleTestDB` });
    const prover = getSubtreeUpdateProver();
    const submitter = new SyncSubtreeSubmitter(wallet);
    updater = new SubtreeUpdater(wallet, serverDB, prover, submitter);
    await updater.init();
  }

  async function applySubtreeUpdate() {
    const tx = await wallet.fillBatchWithZeros();
    await tx.wait(1);
    await updater.pollInsertionsAndTryMakeBatch();
    await updater.tryGenAndSubmitProofs();
  }

  async function stopHH() {
    await hhContainer.stop();
    await hhContainer.remove();
  }

  afterEach(async () => {
    await Promise.all([
      stopHH(),
      updater.dropDB(),
      compose.down({
        cwd: BUNDLER_COMPOSE_CWD,
        commandOptions: [["--volumes"]],
      }),
    ]);
  });

  it("syncs notes, not leaves before subtree update", async () => {
    // deposit notes
    await depositFunds(
      wallet,
      vault,
      token,
      aliceEoa,
      nocturneContextAlice.signer.generateRandomStealthAddress(),
      [100n, 100n]
    );

    // sync SDK
    await nocturneContextAlice.sync();

    // check that DB has notes and merkle doesn't
    //@ts-ignore
    const allNotes = await nocturneContextAlice.db.getAllNotes();
    const notes = Array.from(allNotes.values()).flat();
    expect(notes.length).to.eql(2);

    //@ts-ignore
    expect(await nocturneContextAlice.merkleProver.count()).to.eql(0);
  });

  it("syncs notes and latest non-zero leaves after subtree update", async () => {
    // deposit notes...
    const ncs = await depositFunds(
      wallet,
      vault,
      token,
      aliceEoa,
      nocturneContextAlice.signer.generateRandomStealthAddress(),
      [100n, 100n]
    );
    // apply subtree update and sync SDK
    await applySubtreeUpdate();
    await nocturneContextAlice.sync();

    // check that DB has notes and merkle has leaves for them
    //@ts-ignore
    const allNotes = await nocturneContextAlice.db.getAllNotes();
    const notes = Array.from(allNotes.values()).flat();
    expect(notes.length).to.eql(2);

    //@ts-ignore
    expect(await nocturneContextAlice.merkleProver.count()).to.eql(2);
    expect(
      //@ts-ignore
      BigInt((await nocturneContextAlice.merkleProver.getProof(0)).leaf)
    ).to.equal(ncs[0]);
    expect(
      //@ts-ignore
      BigInt((await nocturneContextAlice.merkleProver.getProof(1)).leaf)
    ).to.equal(ncs[1]);
  });

  it("syncs nullifiers and nullifies notes", async () => {
    // deposit notes...
    console.log("depositing funds...");
    await depositFunds(
      wallet,
      vault,
      token,
      aliceEoa,
      nocturneContextAlice.signer.generateRandomStealthAddress(),
      [80n, 100n]
    );

    // apply subtree update and sync SDK...
    console.log("applying subtree update...");
    await applySubtreeUpdate();

    console.log("syncing SDK...");
    await nocturneContextAlice.sync();

    // spend one of them...
    const asset = {
      assetType: AssetType.ERC20,
      assetAddr: token.address,
      id: 0n,
    };

    const transfer =
      SimpleERC20Token__factory.createInterface().encodeFunctionData(
        "transfer",
        [await aliceEoa.getAddress(), 80n]
      );

    const builder = new OperationRequestBuilder();
    const opRequest = builder
      .unwrap(asset, 80n)
      .action(token.address, transfer)
      .build();

    opRequest.gasPrice = 0n;

    console.log("preparing op...");
    const preSign = await nocturneContextAlice.prepareOperation(opRequest);
    const signed = nocturneContextAlice.signOperation(preSign);
    console.log("proving op...");
    const op = await opProver.proveOperation(signed);

    console.log("submitting op...");
    await submitAndProcessOperation(op);

    // sync SDK again...
    console.log("syncing SDK again...");
    await nocturneContextAlice.sync();

    // check that the DB nullified the spent note
    //@ts-ignore
    const allNotes = await nocturneContextAlice.db.getAllNotes();
    console.log("all notes: ", allNotes);

    const nonZeroNotes = Array.from(allNotes.values())
      .flat()
      .filter((note) => note.value > 0n);
    expect(nonZeroNotes.length).to.eql(1);
  });
});
