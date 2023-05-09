import { expect } from "chai";
import { ethers } from "ethers";
import { DepositManager, Handler } from "@nocturne-xyz/contracts";
import { SimpleERC20Token } from "@nocturne-xyz/contracts/dist/src/SimpleERC20Token";

import { NocturneWalletSDK, MockSubtreeUpdateProver } from "@nocturne-xyz/sdk";
import { setupTestDeployment, setupTestClient } from "../src/deploy";
import { getSubtreeUpdaterDelay, makeRedisInstance } from "../src/utils";
import { makeTestLogger } from "@nocturne-xyz/offchain-utils";
import { SubtreeUpdater } from "@nocturne-xyz/subtree-updater";
import { KEYS_TO_WALLETS } from "../src/keys";
import { depositFundsSingleToken } from "../src/deposit";
import { SubgraphSubtreeUpdaterSyncAdapter } from "@nocturne-xyz/subtree-updater/src/sync/subgraph/adapter";

const { getRedis, clearRedis } = makeRedisInstance();

const PER_SPEND_AMOUNT = 100n;

const logger = makeTestLogger("subtree-updater", "subtree-updater");

describe("subtree updater", async () => {
  let aliceEoa: ethers.Wallet;

  let depositManager: DepositManager;
  let handler: Handler;
  let token: SimpleERC20Token;
  let nocturneWalletSDKAlice: NocturneWalletSDK;
  let subgraphUrl: string;

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
    subgraphUrl =
      testDeployment.actorConfig.configs!.subtreeUpdater!.subgraphUrl!;
    ({ handler, depositManager } = testDeployment);
    const { provider, config } = testDeployment;

    const [_aliceEoa, _subtreeUpdaterEoa] = KEYS_TO_WALLETS(provider);
    aliceEoa = _aliceEoa;

    handler = handler.connect(_subtreeUpdaterEoa);

    ({ nocturneWalletSDKAlice } = await setupTestClient(
      config,
      provider
    ));

    token = testDeployment.tokens.erc20;
    console.log("token deployed at: ", token.address);
  });

  async function newSubtreeUpdater(): Promise<
    [SubtreeUpdater, () => Promise<void>]
  > {
    const syncAdapter = new SubgraphSubtreeUpdaterSyncAdapter(subgraphUrl);
    const updater = new SubtreeUpdater(
      handler,
      syncAdapter,
      logger,
      await getRedis(),
      new MockSubtreeUpdateProver()
    );

    const { promise, teardown } = updater.start();

    return [
      updater,
      async () => {
        await teardown();
        await promise;
      },
    ];
  }

  afterEach(async () => {
    await clearRedis();
  });

  it("can recover state", async () => {
    let [updater, stopUpdater] = await newSubtreeUpdater();
    await depositFundsSingleToken(
      depositManager,
      token,
      aliceEoa,
      nocturneWalletSDKAlice.signer.generateRandomStealthAddress(),
      [PER_SPEND_AMOUNT, PER_SPEND_AMOUNT]
    );

    await handler.fillBatchWithZeros();

    await sleep(getSubtreeUpdaterDelay());
    await stopUpdater();

    // @ts-ignore
    const root = server.updater.tree.root;
    // @ts-ignore
    const nextBlockToIndex = server.updater.nextBlockToIndex;
    // @ts-ignore
    const insertionIndex = server.updater.index;
    // @ts-ignore
    const insertions = server.updater.insertions;

    // simulate restrart
    // recover() will recover its state from DB
    [updater, stopUpdater] = await newSubtreeUpdater();
    await updater.recover(logger);

    // @ts-ignore
    const recoveredRoot = server.updater.tree.root;
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

    await stopUpdater();
  });
});

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
