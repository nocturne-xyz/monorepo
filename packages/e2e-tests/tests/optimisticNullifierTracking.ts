import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { setupTestDeployment, setupTestClient } from "../src/deploy";
import { SimpleERC20Token } from "@nocturne-xyz/contracts/dist/src/SimpleERC20Token";
import {
  Asset,
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
import { submitAndProcessOperation } from "../src/utils";

chai.use(chaiAsPromised);

// 10^9 (e.g. 10 gwei if this was eth)
const GAS_PRICE = 10n * 10n ** 9n;
// 10^9 gas
const GAS_FAUCET_DEFAULT_AMOUNT = 10_000_000n * GAS_PRICE; // 100M gwei

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

  before(async () => {
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

  it("removes optimsitic nullifiers after op succeeds", async () => {
    console.log("deposit funds and commit note commitments");
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
      .action(erc20.address, encodedTransfer)
      .gasPrice(0n)
      .deadline(BigInt(Math.floor(Date.now() / 1000)))
      .build();

    // prepare op
    const preSignOp = await sdk.prepareOperation(opRequest);
    const signedOp = await sdk.signOperation(preSignOp);

    // apply op NFs
    await sdk.applyOptimisticNullifiersForOp(signedOp);

    // DB should have OptimisticNFRecords for merkle index 0 and 1
    const records: Map<number, OptimisticNFRecord> =
      await db.getAllOptimisticNFRecords();
    const keys = new Array(records.keys());
    expect(keys.length).to.equal(2);
    expect(keys).to.include(0);
    expect(keys).to.include(1);

    // when we get balances, we should only see one asset and only 200 tokens
    const balances = await sdk.getAllAssetBalances();
    expect(balances.length).to.equal(1);
    expect(balances[0].asset).to.deep.equal(erc20Asset);
    expect(balances[0].balance).to.equal(200n);

    // prove and submit op
    const op = await proveOperation(joinSplitProver, signedOp);
    await submitAndProcessOperation(op);

    // sync sdk again
    await sdk.sync();

    // DB should have no optimistic NF records
    const recordsAfter: Map<number, OptimisticNFRecord> =
      await db.getAllOptimisticNFRecords();
    expect(recordsAfter.size).to.equal(0);
  });
});
