import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { setupTestDeployment, setupTestClient } from "../src/deploy";
import { SimpleERC20Token } from "@nocturne-xyz/contracts/dist/src/SimpleERC20Token";
import {
  Asset,
  JoinSplitProver,
  NocturneDB,
  NocturneWalletSDK,
  OperationRequestBuilder,
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
    try {
      await teardown();
    } catch (_err) {
      // HACK ignore errors on shutdown
      // TODO fix subtree updater empty insertion bug
      return;
    }
  });

  it("removes optimsitic nullifiers after op succeeds", async () => {
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
    const opRequest = new OperationRequestBuilder()
      .unwrap(erc20Asset, 200n)
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
    const signedOp = await sdk.signOperation(preSignOp);

    console.log("signedOp", signedOp);

    // apply op NFs
    await sdk.applyOptimisticNullifiersForOp(signedOp);

    // DB should have OptimisticNFRecords for merkle index 0 and 1
    const records = await db.getAllOptimisticNFRecords();
    expect(records.size).to.eql(2);
    expect(records.get(0)).to.not.be.undefined;
    expect(records.get(1)).to.not.be.undefined;

    // when we get balances, we should only see one asset and only 200 tokens
    const balances = await sdk.getAllAssetBalances();
    expect(balances.length).to.equal(1);
    // TODO: fix checksum vs call caps
    // expect(balances[0].asset).to.deep.equal(erc20Asset);
    expect(balances[0].balance).to.equal(200n);

    // prove and submit op
    const op = await proveOperation(joinSplitProver, signedOp);
    await submitAndProcessOperation(op);

    // sync sdk again
    await sdk.sync();

    // DB should have no optimistic NF records
    const recordsAfter = await db.getAllOptimisticNFRecords();
    expect(recordsAfter.size).to.equal(0);
  });
});
