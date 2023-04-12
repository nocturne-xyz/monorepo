import { expect } from "chai";
import { ethers } from "ethers";
import { DepositManager, Handler } from "@nocturne-xyz/contracts";
import { SimpleERC20Token } from "@nocturne-xyz/contracts/dist/src/SimpleERC20Token";

import { NocturneWalletSDK, NocturneDB } from "@nocturne-xyz/sdk";
import { setupTestDeployment, setupTestClient } from "../src/deploy";
import { getSubtreeUpdateProver, getSubtreeUpdaterDelay } from "../src/utils";
import { SubtreeUpdateServer } from "@nocturne-xyz/subtree-updater";
import { KEYS_TO_WALLETS } from "../src/keys";
import { depositFundsSingleToken } from "../src/deposit";

const PER_SPEND_AMOUNT = 100n;

describe("subtree updater", async () => {
  let teardown: () => Promise<void>;

  let aliceEoa: ethers.Wallet;
  let subtreeUpdaterEoa: ethers.Wallet;

  let depositManager: DepositManager;
  let handler: Handler;
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
    ({ handler, depositManager } = testDeployment);
    const { provider, contractDeployment } = testDeployment;

    const [_aliceEoa, _subtreeUpdaterEoa] = KEYS_TO_WALLETS(provider);
    aliceEoa = _aliceEoa;
    subtreeUpdaterEoa = _subtreeUpdaterEoa;

    ({ nocturneWalletSDKAlice, nocturneDBAlice } = await setupTestClient(
      contractDeployment,
      provider
    ));

    token = testDeployment.tokens.erc20;
    console.log("token deployed at: ", token.address);

    server = newServer();
    await server.init();
    server.start();
  });

  function newServer(): SubtreeUpdateServer {
    const serverDBPath = `${__dirname}/../db/standaloneServerTestDB`;
    const prover = getSubtreeUpdateProver();
    const server = new SubtreeUpdateServer(
      prover,
      handler.address,
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

    await handler.fillBatchWithZeros();

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
