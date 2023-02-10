// @ts-nocheck
import { expect } from "chai";
import { ethers } from "ethers";
import {
  SimpleERC20Token__factory,
  Vault,
  Wallet,
} from "@nocturne-xyz/contracts";
import { SimpleERC20Token } from "@nocturne-xyz/contracts/dist/src/SimpleERC20Token";

import { NocturneContext, NotesDB } from "@nocturne-xyz/sdk";
import { setupNocturne } from "../src/deploy";
import { getSubtreeUpdateProver, getSubtreeUpdaterDelay } from "../src/utils";
import { SubtreeUpdateServer } from "@nocturne-xyz/subtree-updater";
import Dockerode from "dockerode";
import { startHardhatNetwork } from "../src/hardhat";
import { ACTORS_TO_WALLETS, KEY_LIST } from "../src/keys";
import { depositFunds } from "../src/deposit";

const PER_SPEND_AMOUNT = 100n;
const HH_URL = "http://localhost:8545";

describe("Wallet with standalone SubtreeUpdateServer", async () => {
  let docker: Dockerode;
  let hhContainer: Dockerode.Container;
  let provider: ethers.providers.Provider;
  let aliceEoa: ethers.Signer;
  let vault: Vault;
  let wallet: Wallet;
  let token: SimpleERC20Token;
  let serverSigner: ethers.Signer;
  let nocturneContextAlice: NocturneContext;
  let server: SubtreeUpdateServer;
  let notesDBAlice: NotesDB;

  beforeEach(async () => {
    docker = new Dockerode();
    hhContainer = await startHardhatNetwork(docker, {
      blockTime: 3_000,
      keys: KEY_LIST(),
    });

    provider = new ethers.providers.JsonRpcProvider(HH_URL);
    const etherWallets = ACTORS_TO_WALLETS(provider);
    const deployer = etherWallets.deployer;
    serverSigner = etherWallets.subtreeUpdater;
    ({ aliceEoa, vault, wallet, nocturneContextAlice, notesDBAlice } =
      await setupNocturne(deployer));

    const tokenFactory = new SimpleERC20Token__factory(deployer);
    token = await tokenFactory.deploy();
    console.log("Token deployed at: ", token.address);

    server = newServer();
    await server.init();
    (async () => {
      await server.start();
    })();
  });

  function newServer(): SubtreeUpdateServer {
    const serverDBPath = `${__dirname}/../db/standaloneServerTestDB`;
    const prover = getSubtreeUpdateProver();
    const server = new SubtreeUpdateServer(
      prover,
      wallet.address,
      serverDBPath,
      serverSigner,
      { interval: 1_000 }
    );
    return server;
  }

  afterEach(async () => {
    await notesDBAlice.kv.clear();
    await server.stop();
    await server.dropDB();
    await hhContainer.stop();
    await hhContainer.remove();
  });

  it("can recover state", async () => {
    await depositFunds(
      wallet,
      vault,
      token,
      aliceEoa,
      nocturneContextAlice.signer.address,
      [PER_SPEND_AMOUNT, PER_SPEND_AMOUNT]
    );

    await wallet.fillBatchWithZeros();

    await sleep(getSubtreeUpdaterDelay());
    await server.stop();

    const root = server.updater.tree.root();
    const nextBlockToIndex = server.updater.nextBlockToIndex;
    const insertionIndex = server.updater.index;
    const insertions = server.updater.insertions;

    // simulate restrart
    // init() will recover its state from DB
    server = newServer();
    await server.init();

    const recoveredRoot = server.updater.tree.root();
    const recoveredNextBlockToIndex = server.updater.nextBlockToIndex;
    const recoveredInsertionIndex = server.updater.index;
    const recoveredInsertions = server.updater.insertions;

    expect(recoveredRoot).to.equal(root);
    expect(recoveredNextBlockToIndex).to.equal(nextBlockToIndex);
    expect(recoveredInsertionIndex).to.equal(insertionIndex);
    expect(recoveredInsertions).to.deep.equal(insertions);
  });
});

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
