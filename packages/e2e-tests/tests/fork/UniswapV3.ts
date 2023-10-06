import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { setupTestDeployment, setupTestClient } from "../../src/deploy";
import { ethers } from "ethers";
import {
  DepositManager,
  Handler,
  SimpleERC20Token__factory,
  Teller,
  WETH9,
  WETH9__factory,
} from "@nocturne-xyz/contracts";
import { SimpleERC20Token } from "@nocturne-xyz/contracts/dist/src/SimpleERC20Token";
import {
  queryEvents,
  Asset,
  JoinSplitProver,
  OperationStatus,
  NocturneSigner,
  AssetTrait,
} from "@nocturne-xyz/core";
import {
  NocturneClient,
  NocturneDB,
  newOpRequestBuilder,
  proveOperation,
  OperationRequestWithMetadata,
  signOperation,
} from "@nocturne-xyz/client";
import {
  GAS_FAUCET_DEFAULT_AMOUNT,
  GAS_PRICE,
  ONE_DAY_SECONDS,
  submitAndProcessOperation,
} from "../../src/utils";
import { depositFundsMultiToken } from "../../src/deposit";
import { OperationProcessedEvent } from "@nocturne-xyz/contracts/dist/src/Teller";
import { NocturneConfig } from "@nocturne-xyz/config";
import { UniswapV3Plugin } from "@nocturne-xyz/op-request-plugins";

chai.use(chaiAsPromised);

interface BundlerSubmissionSuccess {
  type: "success";
  expectedBundlerStatus: OperationStatus;
}

interface BundlerSubmissionError {
  type: "error";
  errorMessageLike: string;
}

type BundlerSubmissionResult =
  | BundlerSubmissionSuccess
  | BundlerSubmissionError;

interface TestE2EParams {
  opRequestWithMetadata: OperationRequestWithMetadata;
  expectedResult: BundlerSubmissionResult;
  contractChecks?: () => Promise<void>;
  offchainChecks?: () => Promise<void>;
}

const PER_NOTE_AMOUNT = 100n * 1_000_000n;
const MAINNET_WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const MAINNET_DAI_ADDRESS = "0x6B175474E89094C44Da98b954EedeAC495271d0F";

describe("UniswapV3", async () => {
  let teardown: () => Promise<void>;
  let fillSubtreeBatch: () => Promise<void>;

  let provider: ethers.providers.JsonRpcProvider;
  let aliceEoa: ethers.Wallet;
  let bobEoa: ethers.Wallet;
  let bundlerEoa: ethers.Wallet;

  let config: NocturneConfig;
  let depositManager: DepositManager;
  let teller: Teller;
  let handler: Handler;
  let nocturneSignerAlice: NocturneSigner;
  let nocturneDBAlice: NocturneDB;
  let nocturneClientAlice: NocturneClient;
  let nocturneDBBob: NocturneDB;
  let nocturneClientBob: NocturneClient;
  let joinSplitProver: JoinSplitProver;

  let erc20: SimpleERC20Token;
  let erc20Asset: Asset;

  let gasToken: SimpleERC20Token;
  let gasTokenAsset: Asset;

  beforeEach(async () => {
    const testDeployment = await setupTestDeployment({
      include: {
        bundler: true,
        subtreeUpdater: true,
        subgraph: true,
        depositScreener: true,
      },
    });

    ({
      provider,
      teardown,
      config,
      teller,
      handler,
      weth,
      aliceEoa,
      bobEoa,
      bundlerEoa,
      depositManager,
      fillSubtreeBatch,
    } = testDeployment);

    ({ erc20, erc20Asset, gasToken, gasTokenAsset } = testDeployment.tokens);

    ({
      nocturneDBAlice,
      nocturneSignerAlice,
      nocturneClientAlice,
      nocturneDBBob,
      nocturneClientBob,
      joinSplitProver,
    } = await setupTestClient(testDeployment.config, provider, {
      gasAssets: new Map([["GAS", gasTokenAsset.assetAddr]]),
    }));
  });

  afterEach(async () => {
    await teardown();
  });

  async function testE2E({
    opRequestWithMetadata,
    contractChecks,
    offchainChecks,
    expectedResult,
  }: TestE2EParams): Promise<void> {
    console.log("alice: Sync SDK");
    await nocturneClientAlice.sync();

    console.log("bob: Sync SDK");
    await nocturneClientBob.sync();

    const preOpNotesAlice = await nocturneDBAlice.getAllNotes();
    console.log("alice pre-op notes:", preOpNotesAlice);
    console.log(
      "alice pre-op latestCommittedMerkleIndex",
      await nocturneDBAlice.latestCommittedMerkleIndex()
    );

    console.log("prepare, sign, and prove operation with NocturneClient");
    const preSign = await nocturneClientAlice.prepareOperation(
      opRequestWithMetadata.request
    );
    const signed = signOperation(nocturneSignerAlice, preSign);
    const operation = await proveOperation(joinSplitProver, signed);

    console.log("proven operation:", operation);

    if (expectedResult.type === "error") {
      try {
        await submitAndProcessOperation(operation);
        throw new Error(
          `expected error like: ${expectedResult.errorMessageLike} but got success instead`
        );
      } catch (err) {
        expect((err as Error).message).to.include(
          expectedResult.errorMessageLike
        );
      }
      return;
    }

    const status = await submitAndProcessOperation(operation);
    await contractChecks?.();
    await offchainChecks?.();

    expect(expectedResult.expectedBundlerStatus).to.eql(status);
  }

  it(`alice deposits ten ${PER_NOTE_AMOUNT} and can submit op with 5 joinsplits`, async () => {
    console.log("deposit funds and commit note commitments");
    const weth = WETH9__factory.connect(MAINNET_WETH_ADDRESS, aliceEoa);
    await depositFundsMultiToken(
      depositManager,
      [
        [
          weth,
          [PER_NOTE_AMOUNT, PER_NOTE_AMOUNT, PER_NOTE_AMOUNT, PER_NOTE_AMOUNT],
        ],
        [gasToken, [GAS_FAUCET_DEFAULT_AMOUNT]],
      ],
      aliceEoa,
      nocturneSignerAlice.generateRandomStealthAddress()
    );
    await fillSubtreeBatch();

    const chainId = BigInt((await provider.getNetwork()).chainId);
    const opRequestWithMetadata = await newOpRequestBuilder(
      provider,
      chainId,
      config
    )
      .use(UniswapV3Plugin)
      .swap(MAINNET_WETH_ADDRESS, PER_NOTE_AMOUNT * 2n, MAINNET_DAI_ADDRESS, 50)
      .build();

    const bundlerBalanceBefore = (
      await gasToken.balanceOf(await bundlerEoa.getAddress())
    ).toBigInt();
    console.log("bundler gas asset balance before op:", bundlerBalanceBefore);

    const contractChecks = async () => {
      console.log("check for OperationProcessed event");
      const latestBlock = await provider.getBlockNumber();
      const events: OperationProcessedEvent[] = await queryEvents(
        teller,
        teller.filters.OperationProcessed(),
        0,
        latestBlock
      );
      expect(events.length).to.equal(1);
      expect(events[0].args.opProcessed).to.equal(true);
      expect(events[0].args.callSuccesses[0]).to.equal(true);

      expect(
        (await erc20.balanceOf(await aliceEoa.getAddress())).toBigInt()
      ).to.equal(0n);
      expect(
        (await erc20.balanceOf(await bobEoa.getAddress())).toBigInt()
      ).to.equal(ALICE_TO_BOB_PUB_VAL);
      expect((await erc20.balanceOf(teller.address)).toBigInt()).to.equal(
        10n * PER_NOTE_AMOUNT - ALICE_TO_BOB_PUB_VAL
      );
      expect((await erc20.balanceOf(handler.address)).toBigInt()).to.equal(1n);
    };

    const offchainChecks = async () => {
      console.log("alice: Sync SDK post-operation");
      await nocturneClientAlice.sync();
      const updatedNotesAlice = await nocturneDBAlice.getNotesForAsset(
        erc20Asset,
        { includeUncommitted: true }
      )!;
      const nonZeroNotesAlice = updatedNotesAlice.filter((n) => n.value > 0n);
      // alice should have 2 nonzero notes total, since all 4 notes spent, alice gets 1 output
      // note from JSs and 1 refund note (all in same token)
      expect(nonZeroNotesAlice.length).to.equal(0);
      console.log("alice post-op notes:", nonZeroNotesAlice);

      // check that bundler got compensated for gas
      const bundlerBalanceAfter = (
        await gasToken.balanceOf(await bundlerEoa.getAddress())
      ).toBigInt();

      console.log("bundler gas asset balance after op:", bundlerBalanceAfter);
      // for some reason, mocha `.gte` doesn't work here
      expect(bundlerBalanceAfter > bundlerBalanceBefore).to.be.true;
    };

    await testE2E({
      opRequestWithMetadata,
      contractChecks,
      offchainChecks,
      expectedResult: {
        type: "success",
        expectedBundlerStatus: OperationStatus.EXECUTED_SUCCESS,
      },
    });
  });
});
