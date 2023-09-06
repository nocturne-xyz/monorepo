import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { setupTestDeployment, setupTestClient } from "../src/deploy";
import { ethers } from "ethers";
import {
  CanonicalAddressRegistry,
  DepositManager,
  Handler,
  SimpleERC20Token__factory,
  Teller,
} from "@nocturne-xyz/contracts";
import { SimpleERC20Token } from "@nocturne-xyz/contracts/dist/src/SimpleERC20Token";
import {
  NocturneClient,
  NocturneDB,
  newOpRequestBuilder,
  queryEvents,
  Asset,
  JoinSplitProver,
  proveOperation,
  OperationStatus,
  OperationRequestWithMetadata,
  NocturneSigner,
  signOperation,
} from "@nocturne-xyz/core";
import {
  GAS_FAUCET_DEFAULT_AMOUNT,
  GAS_PRICE,
  ONE_DAY_SECONDS,
  submitAndProcessOperation,
} from "../src/utils";
import { depositFundsMultiToken } from "../src/deposit";
import { OperationProcessedEvent } from "@nocturne-xyz/contracts/dist/src/Teller";

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

interface TestE2eParams {
  opRequestWithMetadata: OperationRequestWithMetadata;
  expectedResult: BundlerSubmissionResult;
  contractChecks?: () => Promise<void>;
  offchainChecks?: () => Promise<void>;
}

const PER_NOTE_AMOUNT = 100n * 1_000_000n;

describe("full system: contracts, sdk, bundler, subtree updater, and subgraph", async () => {
  let teardown: () => Promise<void>;
  let fillSubtreeBatch: () => Promise<void>;

  let provider: ethers.providers.JsonRpcProvider;
  let aliceEoa: ethers.Wallet;
  let bobEoa: ethers.Wallet;

  let canonAddrRegistry: CanonicalAddressRegistry;
  let nocturneSignerAlice: NocturneSigner;
  let nocturneSignerBob: NocturneSigner;

  let gasTokenAsset: Asset;

  beforeEach(async () => {
    const testDeployment = await setupTestDeployment({
      include: {
        bundler: false,
        subtreeUpdater: false,
        subgraph: false,
        depositScreener: false,
      },
    });

    ({ provider, teardown, canonAddrRegistry, aliceEoa, bobEoa } =
      testDeployment);

    ({ gasTokenAsset } = testDeployment.tokens);

    ({ nocturneSignerAlice, nocturneSignerBob } = await setupTestClient(
      testDeployment.config,
      provider,
      {
        gasAssets: new Map([["GAS", gasTokenAsset.assetAddr]]),
      }
    ));
  });

  afterEach(async () => {
    await teardown();
  });

  it("generates sig proof and registers canon addr", async () => {});
});
