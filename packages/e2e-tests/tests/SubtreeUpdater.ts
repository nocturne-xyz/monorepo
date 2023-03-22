import { expect } from "chai";
import { ethers } from "ethers";
import {
  DepositManager,
  SimpleERC20Token__factory,
  Wallet,
} from "@nocturne-xyz/contracts";
import { SimpleERC20Token } from "@nocturne-xyz/contracts/dist/src/SimpleERC20Token";

import { NocturneWalletSDK, NocturneDB } from "@nocturne-xyz/sdk";
import { setupTestDeployment, setupTestClient } from "../src/deploy";
import { getSubtreeUpdateProver, getSubtreeUpdaterDelay } from "../src/utils";
import { SubtreeUpdateServer } from "@nocturne-xyz/subtree-updater";
import { KEYS_TO_WALLETS } from "../src/keys";
import { depositFundsSingleToken } from "../src/deposit";

const PER_SPEND_AMOUNT = 100n;

describe("Wallet with standalone SubtreeUpdateServer", async () => {
  let teardown: () => Promise<void>;

  let aliceEoa: ethers.Wallet;
  let subtreeUpdaterEoa: ethers.Wallet;

  let depositManager: DepositManager;
  let wallet: Wallet;
  let token: SimpleERC20Token;
  let nocturneWalletSDKAlice: NocturneWalletSDK;
  let server: SubtreeUpdateServer;
  let nocturneDBAlice: NocturneDB;

  beforeEach(async () => {
    const testDeployment = await setupTestDeployment({
      include: {
        subgraph: true,
        depositScreener: true,
        bundler: false,
        subtreeUpdater: false,
      },
    });

    teardown = testDeployment.teardown;
    ({ wallet, depositManager } = testDeployment);
    const { provider, contractDeployment } = testDeployment;

    const [deployerEoa, _aliceEoa, _subtreeUpdaterEoa] =
      KEYS_TO_WALLETS(provider);
    aliceEoa = _aliceEoa;
    subtreeUpdaterEoa = _subtreeUpdaterEoa;

    ({ nocturneWalletSDKAlice, nocturneDBAlice } = await setupTestClient(
      contractDeployment,
      provider
    ));

    const tokenFactory = new SimpleERC20Token__factory(deployerEoa);
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
      subtreeUpdaterEoa,
      { interval: 1_000 }
    );
    return server;
  }

  async function teardownServer() {
    await server.stop();
    await server.dropDB();
  }

  afterEach(async () => {
    await Promise.all([
      nocturneDBAlice.kv.clear(),
      teardownServer(),
      teardown(),
    ]);
  });

  it("can recover state", async () => {
    await depositFundsSingleToken(
      depositManager,
      token,
      aliceEoa,
      nocturneWalletSDKAlice.signer.generateRandomStealthAddress(),
      [PER_SPEND_AMOUNT, PER_SPEND_AMOUNT]
    );

    await wallet.fillBatchWithZeros();

    await sleep(getSubtreeUpdaterDelay());
    await server.stop();

    // @ts-ignore
    const root = server.updater.tree.root();
    // @ts-ignore
    const nextBlockToIndex = server.updater.nextBlockToIndex;
    // @ts-ignore
    const insertionIndex = server.updater.index;
    // @ts-ignore
    const insertions = server.updater.insertions;

    // simulate restrart
    // init() will recover its state from DB
    server = newServer();
    await server.init();

    // @ts-ignore
    const recoveredRoot = server.updater.tree.root();
    // @ts-ignore
    const recoveredNextBlockToIndex = server.updater.nextBlockToIndex;
    // @ts-ignore
    const recoveredInsertionIndex = server.updater.index;
    // @ts-ignore
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
