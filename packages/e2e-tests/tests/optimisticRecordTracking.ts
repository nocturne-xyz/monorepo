import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { setupTestDeployment, setupTestClient } from "../src/deploy";
import { SimpleERC20Token } from "@nocturne-xyz/contracts/dist/src/SimpleERC20Token";
import {
  Asset,
  JoinSplitProver,
  NocturneDB,
  NocturneWalletSDK,
  OperationAction,
  OperationRequestBuilder,
  computeOperationDigest,
  proveOperation,
} from "@nocturne-xyz/sdk";
import { depositFundsSingleToken } from "../src/deposit";
import {
  DepositManager,
  SimpleERC20Token__factory,
} from "@nocturne-xyz/contracts";
import { ethers } from "ethers";
import { ONE_DAY_SECONDS, submitAndProcessOperation } from "../src/utils";

chai.use(chaiAsPromised);

describe("Optimistic nullifier tracking", () => {
  let teardown: () => Promise<void>;
  let fillSubtreeBatch: () => Promise<void>;

  let sdk: NocturneWalletSDK;
  let db: NocturneDB;
  let depositManager: DepositManager;
  let eoa: ethers.Wallet;

  let erc20: SimpleERC20Token;
  let erc20Asset: Asset;
  let joinSplitProver: JoinSplitProver;

  beforeEach(async () => {
    const testDeployment = await setupTestDeployment({
      include: {
        bundler: true,
        subtreeUpdater: true,
        subgraph: true,
        depositScreener: true,
      },
      configs: {
        bundler: {
          ignoreGas: true,
        },
      },
    });

    ({ teardown, fillSubtreeBatch, depositManager } = testDeployment);

    eoa = testDeployment.aliceEoa;

    ({ erc20, erc20Asset } = testDeployment.tokens);

    const setup = await setupTestClient(
      testDeployment.config,
      testDeployment.provider,
      {
        gasAssets: new Map([
          ["GAS", testDeployment.tokens.gasTokenAsset.assetAddr],
        ]),
      }
    );

    joinSplitProver = setup.joinSplitProver;
    sdk = setup.nocturneWalletSDKAlice;
    db = setup.nocturneDBAlice;
  });

  afterEach(async () => {
    await teardown();
  });

  it("removes optimistic records when polling op digests", async () => {
    // deposit four 100-token notes
    await depositFundsSingleToken(
      depositManager,
      erc20,
      eoa,
      sdk.signer.canonicalStealthAddress(),
      [100n, 100n, 100n, 100n]
    );
    await fillSubtreeBatch();

    // sync sdk
    await sdk.sync();

    const encodedTransfer =
      SimpleERC20Token__factory.createInterface().encodeFunctionData(
        "transfer",
        [await eoa.getAddress(), 200n]
      );

    // make op request spending 200 tokens
    const amountToSpend = 200n;
    const opRequest = new OperationRequestBuilder()
      .unwrap(erc20Asset, amountToSpend)
      .action(erc20.address, encodedTransfer)
      .gasPrice(0n)
      .deadline(
        BigInt((await depositManager.provider.getBlock("latest")).timestamp) +
          ONE_DAY_SECONDS
      )
      .chainId(31337n)
      .build();

    // prepare op
    const preSignOp = await sdk.prepareOperation(opRequest);
    const signedOp = sdk.signOperation(preSignOp);

    console.log("signedOp", signedOp);

    // apply op NFs
    const action: OperationAction = {
      type: "Transfer",
      erc20Address: erc20Asset.assetAddr,
      recipientAddress: eoa.address,
      amount: amountToSpend,
    };
    await sdk.applyOptimisticRecordsForOp(signedOp, {
      action,
    });

    // DB should have OptimisticNFRecords for merkle index 0 and 1
    const nfRecords = await db.getAllOptimisticNFRecords();
    expect(nfRecords.size).to.eql(2);

    const nfRecord0 = nfRecords.get(0)!; // for leaf 0
    const nfRecord1 = nfRecords.get(1)!; // for leaf 1

    const nfSet = new Set([
      signedOp.joinSplits[0].nullifierA,
      signedOp.joinSplits[0].nullifierB,
    ]);
    expect(nfSet.has(nfRecord0.nullifier)).to.be.true;
    expect(nfSet.has(nfRecord1.nullifier)).to.be.true;
    expect(nfRecord0.nullifier).to.not.eql(nfRecord1.nullifier);

    // Check op digest record
    const opDigest = computeOperationDigest(signedOp);
    const opDigestRecords = await db.getAllOptimisticOpDigestRecords();
    expect(opDigestRecords.size).to.eql(1);

    const opDigestRecord = opDigestRecords.get(opDigest)!;
    expect(opDigestRecord.merkleIndices.length).to.eql(2);

    const leafSet = new Set([0, 1]);
    expect(leafSet.has(opDigestRecord.merkleIndices[0])).to.be.true;
    expect(leafSet.has(opDigestRecord.merkleIndices[1])).to.be.true;
    expect(opDigestRecord.merkleIndices[0]).to.not.eql(
      opDigestRecord.merkleIndices[1]
    );

    expect(opDigestRecord.metadata!.action).to.eql(action);

    // Check exposed op digest + metadata method on wallet sdk
    const opDigestsWithMetadata =
      await sdk.getAllOptimisticOpDigestsWithMetadata();
    expect(opDigestsWithMetadata.length).to.eql(1);
    expect(opDigestsWithMetadata[0].opDigest).to.eql(opDigest);
    expect(opDigestsWithMetadata[0].metadata).to.eql({ action });

    // when we get balances, we should only see one asset and only 200 tokens
    const balances = await sdk.getAllAssetBalances();
    expect(balances.length).to.equal(1);
    // TODO: fix checksum vs call caps
    // expect(balances[0].asset).to.deep.equal(erc20Asset);
    expect(balances[0].balance).to.equal(200n);

    // prove and submit op
    const op = await proveOperation(joinSplitProver, signedOp);
    await submitAndProcessOperation(op);

    // ensure it removes all records when it polls op digest from bundler
    await sdk.updateOptimisticNullifiers();

    // DB should have no more optimistic records
    const nfRecordsAfter = await db.getAllOptimisticNFRecords();
    expect(nfRecordsAfter.size).to.equal(0);

    const opDigestRecordsAfter = await db.getAllOptimisticOpDigestRecords();
    expect(opDigestRecordsAfter.size).to.equal(0);

    expect(balances[0].balance).to.equal(200n);
  });

  it("removes optimistic NFs after syncing NFs in joinsplits", async () => {
    // deposit four 100-token notes
    await depositFundsSingleToken(
      depositManager,
      erc20,
      eoa,
      sdk.signer.canonicalStealthAddress(),
      [100n, 100n, 100n, 100n]
    );
    await fillSubtreeBatch();

    // sync sdk
    await sdk.sync();

    const encodedTransfer =
      SimpleERC20Token__factory.createInterface().encodeFunctionData(
        "transfer",
        [await eoa.getAddress(), 200n]
      );

    // make op request spending 200 tokens
    const amountToSpend = 200n;
    const opRequest = new OperationRequestBuilder()
      .unwrap(erc20Asset, amountToSpend)
      .action(erc20.address, encodedTransfer)
      .gasPrice(0n)
      .deadline(
        BigInt((await depositManager.provider.getBlock("latest")).timestamp) +
          ONE_DAY_SECONDS
      )
      .chainId(31337n)
      .build();

    // prepare op
    const preSignOp = await sdk.prepareOperation(opRequest);
    const signedOp = sdk.signOperation(preSignOp);

    console.log("signedOp", signedOp);

    // apply op NFs
    const action: OperationAction = {
      type: "Transfer",
      erc20Address: erc20Asset.assetAddr,
      recipientAddress: eoa.address,
      amount: amountToSpend,
    };
    await sdk.applyOptimisticRecordsForOp(signedOp, { action });

    // DB should have OptimisticNFRecords for merkle index 0 and 1
    const nfRecords = await db.getAllOptimisticNFRecords();
    expect(nfRecords.size).to.eql(2);

    const nfRecord0 = nfRecords.get(0)!; // for leaf 0
    const nfRecord1 = nfRecords.get(1)!; // for leaf 1

    const nfSet = new Set([
      signedOp.joinSplits[0].nullifierA,
      signedOp.joinSplits[0].nullifierB,
    ]);
    expect(nfSet.has(nfRecord0.nullifier)).to.be.true;
    expect(nfSet.has(nfRecord1.nullifier)).to.be.true;
    expect(nfRecord0.nullifier).to.not.eql(nfRecord1.nullifier);

    // Check op digest record
    const opDigest = computeOperationDigest(signedOp);
    const opDigestRecords = await db.getAllOptimisticOpDigestRecords();
    expect(opDigestRecords.size).to.eql(1);

    const opDigestRecord = opDigestRecords.get(opDigest)!;
    expect(opDigestRecord.merkleIndices.length).to.eql(2);

    const leafSet = new Set([0, 1]);
    expect(leafSet.has(opDigestRecord.merkleIndices[0])).to.be.true;
    expect(leafSet.has(opDigestRecord.merkleIndices[1])).to.be.true;
    expect(opDigestRecord.merkleIndices[0]).to.not.eql(
      opDigestRecord.merkleIndices[1]
    );

    expect(opDigestRecord.metadata!.action).to.eql(action);

    // Check exposed op digest + metadata method on wallet sdk
    const opDigestsWithMetadata =
      await sdk.getAllOptimisticOpDigestsWithMetadata();
    expect(opDigestsWithMetadata.length).to.eql(1);
    expect(opDigestsWithMetadata[0].opDigest).to.eql(opDigest);
    expect(opDigestsWithMetadata[0].metadata).to.eql({ action });

    // when we get balances, we should only see one asset and only 200 tokens
    const balances = await sdk.getAllAssetBalances();
    expect(balances.length).to.equal(1);
    // TODO: fix checksum vs call caps
    // expect(balances[0].asset).to.deep.equal(erc20Asset);
    expect(balances[0].balance).to.equal(200n);

    // prove and submit op
    const op = await proveOperation(joinSplitProver, signedOp);
    await submitAndProcessOperation(op);

    // ensure it removes NFs when it indexes NFs from events
    await sdk.sync();

    // DB should have no optimistic NF records
    const nfRecordsAfter = await db.getAllOptimisticNFRecords();
    expect(nfRecordsAfter.size).to.equal(0);

    // DB still has op digest record (doesn't get removed by indexing NFs)
    const opDigestRecordsAfter = await db.getAllOptimisticOpDigestRecords();
    expect(opDigestRecordsAfter.size).to.equal(1);

    expect(balances[0].balance).to.equal(200n);
  });
});
