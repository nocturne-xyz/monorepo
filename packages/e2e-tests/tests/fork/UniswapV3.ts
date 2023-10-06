import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { setupTestDeployment } from "../../src/deploy";
import { ethers } from "ethers";
// import {
//   DepositManager,
//   Handler,
//   SimpleERC20Token__factory,
//   Teller,
//   WETH9,
//   WETH9__factory,
// } from "@nocturne-xyz/contracts";
// import { SimpleERC20Token } from "@nocturne-xyz/contracts/dist/src/SimpleERC20Token";
// import {
//   queryEvents,
//   Asset,
//   JoinSplitProver,
//   OperationStatus,
//   NocturneSigner,
//   AssetTrait,
// } from "@nocturne-xyz/core";
// import {
//   NocturneClient,
//   NocturneDB,
//   newOpRequestBuilder,
//   proveOperation,
//   OperationRequestWithMetadata,
//   signOperation,
// } from "@nocturne-xyz/client";
// import {
//   GAS_FAUCET_DEFAULT_AMOUNT,
//   GAS_PRICE,
//   ONE_DAY_SECONDS,
//   submitAndProcessOperation,
// } from "../../src/utils";
// import { depositFundsMultiToken } from "../../src/deposit";
// import { OperationProcessedEvent } from "@nocturne-xyz/contracts/dist/src/Teller";
// import { NocturneConfig } from "@nocturne-xyz/config";
import { UniswapV3Plugin } from "@nocturne-xyz/op-request-plugins";
import { newOpRequestBuilder } from "@nocturne-xyz/client";
import { WETH9__factory } from "@nocturne-xyz/contracts";

chai.use(chaiAsPromised);

// interface BundlerSubmissionSuccess {
//   type: "success";
//   expectedBundlerStatus: OperationStatus;
// }

// interface BundlerSubmissionError {
//   type: "error";
//   errorMessageLike: string;
// }

// type BundlerSubmissionResult =
//   | BundlerSubmissionSuccess
//   | BundlerSubmissionError;

// interface TestE2EParams {
//   opRequestWithMetadata: OperationRequestWithMetadata;
//   expectedResult: BundlerSubmissionResult;
//   contractChecks?: () => Promise<void>;
//   offchainChecks?: () => Promise<void>;
// }

// const PER_NOTE_AMOUNT = 100n * 1_000_000n;
const MAINNET_WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const MAINNET_DAI_ADDRESS = "0x6B175474E89094C44Da98b954EedeAC495271d0F";

describe("UniswapV3", async () => {
  let teardown: () => Promise<void>;
  // let fillSubtreeBatch: () => Promise<void>;

  let provider: ethers.providers.JsonRpcProvider;
  let aliceEoa: ethers.Wallet;
  // let bobEoa: ethers.Wallet;
  // let bundlerEoa: ethers.Wallet;

  // let config: NocturneConfig;
  // let depositManager: DepositManager;
  // let teller: Teller;
  // let handler: Handler;
  // let nocturneSignerAlice: NocturneSigner;
  // let nocturneDBAlice: NocturneDB;
  // let nocturneClientAlice: NocturneClient;
  // let nocturneDBBob: NocturneDB;
  // let nocturneClientBob: NocturneClient;
  // let joinSplitProver: JoinSplitProver;

  // let erc20: SimpleERC20Token;
  // let erc20Asset: Asset;

  // let gasToken: SimpleERC20Token;
  // let gasTokenAsset: Asset;

  beforeEach(async () => {
    const testDeployment = await setupTestDeployment(
      {
        include: {
          bundler: false,
          subtreeUpdater: false,
          subgraph: false,
          depositScreener: false,
        },
      },
      "mainnet"
    );

    ({
      provider,
      teardown,
      // config,
      // teller,
      // handler,
      aliceEoa,
      // bobEoa,
      // bundlerEoa,
      // depositManager,
      // fillSubtreeBatch,
    } = testDeployment);

    // ({ erc20, erc20Asset, gasToken, gasTokenAsset } = testDeployment.tokens);

    // ({
    //   nocturneDBAlice,
    //   nocturneSignerAlice,
    //   nocturneClientAlice,
    //   nocturneDBBob,
    //   nocturneClientBob,
    //   joinSplitProver,
    // } = await setupTestClient(testDeployment.config, provider, {
    //   gasAssets: new Map([["GAS", gasTokenAsset.assetAddr]]),
    // }));
  });

  afterEach(async () => {
    await teardown();
  });

  // async function testE2E({
  //   opRequestWithMetadata,
  //   contractChecks,
  //   offchainChecks,
  //   expectedResult,
  // }: TestE2EParams): Promise<void> {
  //   console.log("alice: Sync SDK");
  //   await nocturneClientAlice.sync();

  //   console.log("bob: Sync SDK");
  //   await nocturneClientBob.sync();

  //   const preOpNotesAlice = await nocturneDBAlice.getAllNotes();
  //   console.log("alice pre-op notes:", preOpNotesAlice);
  //   console.log(
  //     "alice pre-op latestCommittedMerkleIndex",
  //     await nocturneDBAlice.latestCommittedMerkleIndex()
  //   );

  //   console.log("prepare, sign, and prove operation with NocturneClient");
  //   const preSign = await nocturneClientAlice.prepareOperation(
  //     opRequestWithMetadata.request
  //   );
  //   const signed = signOperation(nocturneSignerAlice, preSign);
  //   const operation = await proveOperation(joinSplitProver, signed);

  //   console.log("proven operation:", operation);

  //   if (expectedResult.type === "error") {
  //     try {
  //       await submitAndProcessOperation(operation);
  //       throw new Error(
  //         `expected error like: ${expectedResult.errorMessageLike} but got success instead`
  //       );
  //     } catch (err) {
  //       expect((err as Error).message).to.include(
  //         expectedResult.errorMessageLike
  //       );
  //     }
  //     return;
  //   }

  //   const status = await submitAndProcessOperation(operation);
  //   await contractChecks?.();
  //   await offchainChecks?.();

  //   expect(expectedResult.expectedBundlerStatus).to.eql(status);
  // }

  it("submits raw swap request to UniswapV3 without Nocturne", async () => {
    console.log("creating op request");
    const chainId = 1n;
    const opRequestWithMetadata = await newOpRequestBuilder(provider, chainId)
      .use(UniswapV3Plugin)
      .swap(
        MAINNET_WETH_ADDRESS,
        1000000000000000000n, // 1 ETH
        MAINNET_DAI_ADDRESS,
        50
      )
      .build();

    const {
      contractAddress: wethAddress,
      encodedFunction: approveEncodedFunction,
    } = opRequestWithMetadata.request.actions[0];
    const {
      contractAddress: swapRouterAddress,
      encodedFunction: swapEncodedFunction,
    } = opRequestWithMetadata.request.actions[1];

    const weth = WETH9__factory.connect(MAINNET_WETH_ADDRESS, aliceEoa);

    console.log("depositing ETH into WETH");
    await weth.deposit({ value: 2000000000000000000n }); // 2 ETH

    console.log("approving weth to uniswap");
    await aliceEoa.sendTransaction({
      to: wethAddress,
      data: approveEncodedFunction,
    });

    console.log("sending swap tx");
    const swapTx = await aliceEoa.sendTransaction({
      to: swapRouterAddress,
      data: swapEncodedFunction,
    });

    console.log("tx response:", swapTx);
  });
});
