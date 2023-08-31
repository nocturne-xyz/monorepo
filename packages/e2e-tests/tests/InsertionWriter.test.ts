import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import {
  SUBGRAPH_URL,
  setupTestClient,
  setupTestDeployment,
} from "../src/deploy";
import { DepositManager, Teller } from "@nocturne-xyz/contracts";
import {
  Asset,
  Erc20Plugin,
  JoinSplitProver,
  NocturneClient,
  NocturneSigner,
  newOpRequestBuilder,
  proveOperation,
  range,
  signOperation,
  sleep,
} from "@nocturne-xyz/core";
import { depositFundsSingleToken } from "../src/deposit";
import {
  getAllTreeInsertionsFromSubgraph,
  makeRedisInstance,
  submitAndProcessOperation,
} from "../src/utils";
import { makeTestLogger } from "@nocturne-xyz/offchain-utils";
import {
  InsertionWriter,
  SubgraphTreeInsertionSyncAdapter,
} from "@nocturne-xyz/insertion-writer";
import IORedis from "ioredis";
import * as ethers from "ethers";
import { SimpleERC20Token } from "@nocturne-xyz/contracts/dist/src/SimpleERC20Token";

chai.use(chaiAsPromised);

const { getRedis, clearRedis } = makeRedisInstance();

describe("InsertionWriter", () => {
  let fillSubtreeBatch: () => Promise<void>;
  let teardown: () => Promise<void>;
  let prover: JoinSplitProver;
  let teller: Teller;
  let depositManager: DepositManager;
  let signer: NocturneSigner;
  let client: NocturneClient;
  let eoa: ethers.Wallet;
  let token: SimpleERC20Token;
  let asset: Asset;
  let redis: IORedis;

  beforeEach(async () => {
    const testDeployment = await setupTestDeployment({
      include: {
        bundler: true,
        subgraph: true,
        subtreeUpdater: true,
        depositScreener: true,
      },
      configs: {
        bundler: {
          ignoreGas: true,
        },
      },
    });

    fillSubtreeBatch = testDeployment.fillSubtreeBatch;
    teardown = testDeployment.teardown;
    teller = testDeployment.teller;
    depositManager = testDeployment.depositManager;
    token = testDeployment.tokens.gasToken;
    eoa = testDeployment.aliceEoa;
    asset = testDeployment.tokens.gasTokenAsset;
    redis = await getRedis();

    const clientSetup = await setupTestClient(
      testDeployment.config,
      testDeployment.provider,
      {
        gasAssets: new Map([["GAS", asset.assetAddr]]),
      }
    );

    signer = clientSetup.nocturneSignerAlice;
    client = clientSetup.nocturneClientAlice;
    prover = clientSetup.joinSplitProver;
  });

  afterEach(async () => {
    await Promise.all([teardown(), clearRedis()]);
  });

  it("replicates insertion log with only deposits", async () => {
    const logger = makeTestLogger(
      "insertion-writer",
      "should replicate insertion log"
    );
    const adapter = new SubgraphTreeInsertionSyncAdapter(
      SUBGRAPH_URL,
      logger.child({ function: "adapter" })
    );
    const writer = new InsertionWriter(adapter, redis, logger);
    const handle = await writer.start();

    // deposit
    await depositFundsSingleToken(
      depositManager,
      token,
      eoa,
      client.viewer.canonicalStealthAddress(),
      range(17).map((i) => BigInt(i))
    );

    // wait for insertion writer to do its thing
    await sleep(10_000);
    await handle.teardown();

    // check insertion log in redis matches expected
    const expectedInsertions = await getAllTreeInsertionsFromSubgraph();
    const actualInsertions = (await writer.insertionLog.scan().collect())
      .flat()
      .map(({ inner }) => inner);
    expect(actualInsertions).to.deep.equal(expectedInsertions);
  });

  it("replicates insertion log with deposits and ops", async () => {
    const logger = makeTestLogger(
      "insertion-writer",
      "should replicate insertion log"
    );
    const adapter = new SubgraphTreeInsertionSyncAdapter(
      SUBGRAPH_URL,
      logger.child({ function: "adapter" })
    );
    const writer = new InsertionWriter(adapter, redis, logger);
    const handle = await writer.start();

    // deposit
    await depositFundsSingleToken(
      depositManager,
      token,
      eoa,
      client.viewer.canonicalStealthAddress(),
      range(5).map((i) => BigInt(i))
    );

    await fillSubtreeBatch();

    // do an op
    const eoaAddr = await eoa.getAddress();
    const opRequest = newOpRequestBuilder({
      chainId: 31337n,
      tellerContract: teller.address,
    })
      .use(Erc20Plugin)
      .gasPrice(0n)
      .erc20Transfer(asset.assetAddr, eoaAddr, 1n)
      .build();

    const op = await client.prepareOperation(opRequest.request);
    const signedOp = signOperation(signer, op);
    const provenOp = await proveOperation(prover, signedOp);
    await submitAndProcessOperation(provenOp);

    // wait for insertion writer to do its thing
    await sleep(10_000);
    await handle.teardown();

    // check insertion log in redis matches expected
    const expectedInsertions = await getAllTreeInsertionsFromSubgraph();
    const actualInsertions = (await writer.insertionLog.scan().collect())
      .flat()
      .map(({ inner }) => inner);
    expect(actualInsertions).to.deep.equal(expectedInsertions);
  });

  it("continues where it left off after shutdown", async () => {
    const logger = makeTestLogger(
      "insertion-writer",
      "should replicate insertion log"
    );
    const adapter = new SubgraphTreeInsertionSyncAdapter(
      SUBGRAPH_URL,
      logger.child({ function: "adapter" })
    );
    const writer = new InsertionWriter(adapter, redis, logger);
    let handle = await writer.start();

    // deposit
    await depositFundsSingleToken(
      depositManager,
      token,
      eoa,
      client.viewer.canonicalStealthAddress(),
      range(17).map((i) => BigInt(i))
    );

    // wait for insertion writer to do its thing
    await sleep(10_000);
    await handle.teardown();

    // make more deposits
    await depositFundsSingleToken(
      depositManager,
      token,
      eoa,
      client.viewer.canonicalStealthAddress(),
      range(17).map((i) => BigInt(i))
    );

    // start insertion writer again
    handle = await writer.start();

    // wait for insertion writer to do its thing
    await sleep(10_000);
    await handle.teardown();

    // check insertion log in redis matches expected
    const expectedInsertions = await getAllTreeInsertionsFromSubgraph();
    const actualInsertions = (await writer.insertionLog.scan().collect())
      .flat()
      .map(({ inner }) => inner);
    expect(actualInsertions).to.deep.equal(expectedInsertions);
  });
});
