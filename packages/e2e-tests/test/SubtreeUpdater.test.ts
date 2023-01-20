import { expect } from "chai";
import { ethers, network } from "hardhat";
import {
  SimpleERC20Token__factory,
  Vault,
  Vault__factory,
  Wallet,
  Wallet__factory,
  deployNocturne,
} from "@nocturne-xyz/contracts";
import { SimpleERC20Token } from "@nocturne-xyz/contracts/dist/src/SimpleERC20Token";

import { NocturneContext, NotesDB } from "@nocturne-xyz/sdk";
import {
  depositFunds,
  getSubtreeUpdateProver,
  getSubtreeUpdaterDelay,
  setupAliceAndBob,
} from "./utils";
import { SubtreeUpdateServer } from "@nocturne-xyz/subtree-updater";

const PER_SPEND_AMOUNT = 100n;
const TEST_SERVER_POLL_INTERVAL = 1000;

const DUMMY_PROXY_ADMIN_OWNER = "0x3CACa7b48D0573D793d3b0279b5F0029180E83b6";

describe("Wallet with standalone SubtreeUpdateServer", async () => {
  let deployer: ethers.Signer;
  let alice: ethers.Signer;
  let serverSigner: ethers.Signer;
  let vault: Vault;
  let wallet: Wallet;
  let token: SimpleERC20Token;
  let nocturneContext: NocturneContext;
  let server: SubtreeUpdateServer;
  let notesDB: NotesDB;

  beforeEach(async () => {
    const signers = await ethers.getSigners();
    deployer = signers[0];
    serverSigner = signers[1];

    const tokenFactory = new SimpleERC20Token__factory(deployer);
    token = await tokenFactory.deploy();
    console.log("Token deployed at: ", token.address);

    const { walletProxy, vaultProxy } = await deployNocturne(
      DUMMY_PROXY_ADMIN_OWNER,
      { provider: ethers.provider, mockSubtreeUpdateVerifier: true }
    );
    wallet = Wallet__factory.connect(walletProxy.proxyAddress, deployer);
    vault = Vault__factory.connect(vaultProxy.proxyAddress, deployer);

    const setup = await setupAliceAndBob(wallet);
    alice = setup.alice;
    nocturneContext = setup.nocturneContextAlice;

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
      TEST_SERVER_POLL_INTERVAL
    );
    return server;
  }

  afterEach(async () => {
    await notesDB.kv.clear();
    await server.stop();
    await server.dropDB();
    await network.provider.send("hardhat_reset");
  });

  it("can recover state", async () => {
    await depositFunds(
      wallet,
      vault,
      token,
      alice,
      nocturneContext.signer.address,
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
