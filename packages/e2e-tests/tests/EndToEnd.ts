import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { setupTestDeployment, setupTestClient } from "../src/deploy";
import { ethers } from "ethers";
import {
  DepositManager,
  Handler,
  SimpleERC1155Token__factory,
  SimpleERC20Token__factory,
  SimpleERC721Token__factory,
  Teller,
} from "@nocturne-xyz/contracts";
import { SimpleERC20Token } from "@nocturne-xyz/contracts/dist/src/SimpleERC20Token";
import { SimpleERC721Token } from "@nocturne-xyz/contracts/dist/src/SimpleERC721Token";
import { SimpleERC1155Token } from "@nocturne-xyz/contracts/dist/src/SimpleERC1155Token";
import {
  NocturneWalletSDK,
  NocturneDB,
  OperationRequest,
  OperationRequestBuilder,
  queryEvents,
  Asset,
  JoinSplitProver,
  proveOperation,
  OperationStatus,
  OperationRequestWithMetadata,
} from "@nocturne-xyz/core";
import {
  GAS_FAUCET_DEFAULT_AMOUNT,
  GAS_PRICE,
  ONE_DAY_SECONDS,
  submitAndProcessOperation,
} from "../src/utils";
import {
  depositFundsMultiToken,
  depositFundsSingleToken,
} from "../src/deposit";
import { OperationProcessedEvent } from "@nocturne-xyz/contracts/dist/src/Teller";

chai.use(chaiAsPromised);

// ALICE_UNWRAP_VAL + ALICE_TO_BOB_PRIV_VAL should be between PER_NOTE_AMOUNT
// and and 2 * PER_NOTE_AMOUNT
const PER_NOTE_AMOUNT = 100n * 1_000_000n;
const ALICE_UNWRAP_VAL = 120n * 1_000_000n;
const ALICE_TO_BOB_PUB_VAL = 100n * 1_000_000n;
const ALICE_TO_BOB_PRIV_VAL = 30n * 1_000_000n;

const PLUTOCRACY_AMOUNT = 3n;

describe("full system: contracts, sdk, bundler, subtree updater, and subgraph", async () => {
  let teardown: () => Promise<void>;
  let fillSubtreeBatch: () => Promise<void>;

  let provider: ethers.providers.JsonRpcProvider;
  let aliceEoa: ethers.Wallet;
  let bobEoa: ethers.Wallet;
  let bundlerEoa: ethers.Wallet;

  let depositManager: DepositManager;
  let teller: Teller;
  let handler: Handler;
  let nocturneDBAlice: NocturneDB;
  let nocturneWalletSDKAlice: NocturneWalletSDK;
  let nocturneDBBob: NocturneDB;
  let nocturneWalletSDKBob: NocturneWalletSDK;
  let joinSplitProver: JoinSplitProver;

  let erc20: SimpleERC20Token;
  let erc20Asset: Asset;

  let erc721: SimpleERC721Token;
  let erc721Asset: Asset;

  let erc1155: SimpleERC1155Token;
  let erc1155Asset: Asset;

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
      teller,
      handler,
      aliceEoa,
      bobEoa,
      bundlerEoa,
      depositManager,
      fillSubtreeBatch,
    } = testDeployment);

    ({
      erc20,
      erc20Asset,
      erc721,
      erc721Asset,
      erc1155,
      erc1155Asset,
      gasToken,
      gasTokenAsset,
    } = testDeployment.tokens);

    ({
      nocturneDBAlice,
      nocturneWalletSDKAlice,
      nocturneDBBob,
      nocturneWalletSDKBob,
      joinSplitProver,
    } = await setupTestClient(testDeployment.config, provider, {
      gasAssets: new Map([["GAS", gasTokenAsset.assetAddr]]),
    }));
  });

  afterEach(async () => {
    await teardown();
  });

  async function testE2E(
    opRequestWithMetadata: OperationRequestWithMetadata,
    contractChecks: () => Promise<void>,
    offchainChecks: () => Promise<void>,
    expectedBundlerStatus: OperationStatus
  ): Promise<void> {
    console.log("alice: Sync SDK");
    await nocturneWalletSDKAlice.sync();

    console.log("bob: Sync SDK");
    await nocturneWalletSDKBob.sync();

    const preOpNotesAlice = await nocturneDBAlice.getAllNotes();
    console.log("alice pre-op notes:", preOpNotesAlice);
    console.log(
      "alice pre-op latestCommittedMerkleIndex",
      await nocturneDBAlice.latestCommittedMerkleIndex()
    );

    console.log("prepare, sign, and prove operation with NocturneWalletSDK");
    const preSign = await nocturneWalletSDKAlice.prepareOperation(
      opRequestWithMetadata.request
    );
    const signed = nocturneWalletSDKAlice.signOperation(preSign);
    const operation = await proveOperation(joinSplitProver, signed);

    //@ts-ignore
    console.log(nocturneWalletSDKAlice.merkleProver.root.hash);

    const status = await submitAndProcessOperation(operation);

    await contractChecks();
    await offchainChecks();
    expect(expectedBundlerStatus).to.eql(status);
  }

  it("bundler rejects operation with gas price < chain's gas price", async () => {
    console.log("deposit funds");
    await depositFundsMultiToken(
      depositManager,
      [
        [erc20, [PER_NOTE_AMOUNT, PER_NOTE_AMOUNT]],
        [gasToken, [GAS_FAUCET_DEFAULT_AMOUNT]],
      ],
      aliceEoa,
      nocturneWalletSDKAlice.signer.generateRandomStealthAddress()
    );
    console.log("fill batch and wait for subtree update");
    await fillSubtreeBatch();

    // make an operation with gas price < chain's gas price (1 wei <<< 1 gwei)
    // HH's default gas price seems to be somewhere around 1 gwei experimentally
    // unfortunately it doesn't have a way to set it in the chain itself, only in hre
    const operationRequest = new OperationRequestBuilder()
      .unwrap(erc20Asset, ALICE_UNWRAP_VAL)
      .gasPrice(1n)
      .chainId(BigInt((await provider.getNetwork()).chainId))
      .deadline(
        BigInt((await provider.getBlock("latest")).timestamp) + ONE_DAY_SECONDS
      )
      .build();

    await expect(
      testE2E(
        operationRequest,
        async () => {},
        async () => {},
        OperationStatus.BUNDLE_REVERTED
      )
    ).to.eventually.be.rejectedWith("gas price too low");
  });

  it("bundler marks under-gassed operation OPERATION_EXECUTION_FAILED", async () => {
    console.log("deposit funds and commit note commitments");
    await depositFundsMultiToken(
      depositManager,
      [
        [erc20, [PER_NOTE_AMOUNT, PER_NOTE_AMOUNT]],
        [gasToken, [GAS_FAUCET_DEFAULT_AMOUNT]],
      ],
      aliceEoa,
      nocturneWalletSDKAlice.signer.generateRandomStealthAddress()
    );
    await fillSubtreeBatch();

    console.log("encode transfer erc20 action");
    const encodedFunction =
      SimpleERC20Token__factory.createInterface().encodeFunctionData(
        "transfer",
        [await bobEoa.getAddress(), ALICE_TO_BOB_PUB_VAL]
      );

    const operationRequest = new OperationRequestBuilder()
      .unwrap(erc20Asset, ALICE_UNWRAP_VAL)
      .action(erc20.address, encodedFunction)
      .gas({
        executionGasLimit: 1n, // Intentionally too low
        gasPrice: GAS_PRICE,
      })
      .chainId(BigInt((await provider.getNetwork()).chainId))
      .deadline(
        BigInt((await provider.getBlock("latest")).timestamp) + ONE_DAY_SECONDS
      )
      .build();

    await testE2E(
      operationRequest,
      async () => {},
      async () => {},
      OperationStatus.OPERATION_EXECUTION_FAILED
    );
  });

  it(`alice deposits two ${PER_NOTE_AMOUNT} token notes, unwraps ${ALICE_UNWRAP_VAL} tokens publicly, ERC20 transfers ${ALICE_TO_BOB_PUB_VAL} to Bob, and pays ${ALICE_TO_BOB_PRIV_VAL} to Bob privately`, async () => {
    console.log("deposit funds and commit note commitments");
    await depositFundsMultiToken(
      depositManager,
      [
        [erc20, [PER_NOTE_AMOUNT, PER_NOTE_AMOUNT]],
        [gasToken, [GAS_FAUCET_DEFAULT_AMOUNT]],
      ],
      aliceEoa,
      nocturneWalletSDKAlice.signer.generateRandomStealthAddress()
    );
    await fillSubtreeBatch();

    console.log("encode transfer erc20 action");
    const encodedFunction =
      SimpleERC20Token__factory.createInterface().encodeFunctionData(
        "transfer",
        [await bobEoa.getAddress(), ALICE_TO_BOB_PUB_VAL]
      );

    const operationRequest = new OperationRequestBuilder()
      .unwrap(erc20Asset, ALICE_UNWRAP_VAL)
      .confidentialPayment(
        erc20Asset,
        ALICE_TO_BOB_PRIV_VAL,
        nocturneWalletSDKBob.signer.canonicalAddress()
      )
      .action(erc20.address, encodedFunction)
      .gasPrice(GAS_PRICE)
      .chainId(BigInt((await provider.getNetwork()).chainId))
      .deadline(
        BigInt((await provider.getBlock("latest")).timestamp) + ONE_DAY_SECONDS
      )
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
        2n * PER_NOTE_AMOUNT - ALICE_TO_BOB_PUB_VAL
      );
      expect((await erc20.balanceOf(handler.address)).toBigInt()).to.equal(1n);
    };

    const offchainChecks = async () => {
      console.log("alice: Sync SDK post-operation");
      await nocturneWalletSDKAlice.sync();
      const updatedNotesAlice = await nocturneDBAlice.getNotesForAsset(
        erc20Asset,
        { includeUncommitted: true }
      )!;
      const nonZeroNotesAlice = updatedNotesAlice.filter((n) => n.value > 0n);
      // alice should have two nonzero notes total
      expect(nonZeroNotesAlice.length).to.equal(2);
      console.log("alice post-op notes:", nonZeroNotesAlice);

      // alice should have a note with refund value from public spendk
      let foundNotesAlice = nonZeroNotesAlice.filter(
        (n) => n.value === ALICE_UNWRAP_VAL - ALICE_TO_BOB_PUB_VAL
      );
      expect(foundNotesAlice.length).to.equal(1);

      // alice should have another note with refund value from private payment to bob
      foundNotesAlice = nonZeroNotesAlice.filter(
        (n) =>
          n.value ===
          2n * PER_NOTE_AMOUNT - ALICE_UNWRAP_VAL - ALICE_TO_BOB_PRIV_VAL
      );
      expect(foundNotesAlice.length).to.equal(1);

      console.log("bob: Sync SDK post-operation");
      await nocturneWalletSDKBob.sync();
      const updatedNotesBob = await nocturneDBBob.getNotesForAsset(erc20Asset, {
        includeUncommitted: true,
      })!;
      const nonZeroNotesBob = updatedNotesBob.filter((n) => n.value > 0n);
      // bob should have one nonzero note total
      expect(nonZeroNotesBob.length).to.equal(1);

      // That one note should contain the tokens sent privately from alice
      expect(nonZeroNotesBob[0].value).to.equal(ALICE_TO_BOB_PRIV_VAL);

      // check that bundler got compensated for gas, at least enough that it breaks even
      const bundlerBalanceAfter = (
        await gasToken.balanceOf(await bundlerEoa.getAddress())
      ).toBigInt();

      console.log("bundler gas asset balance after op:", bundlerBalanceAfter);
      // for some reason, mocha `.gte` doesn't work here
      expect(bundlerBalanceAfter > bundlerBalanceBefore).to.be.true;
    };

    await testE2E(
      operationRequest,
      contractChecks,
      offchainChecks,
      OperationStatus.EXECUTED_SUCCESS
    );
  });

  it(`alice mints an ERC721 and ERC1155 and receives them privately them as refunds to her Nocturne address`, async () => {
    console.log("deposit funds and commit note commitments");
    await depositFundsSingleToken(
      depositManager,
      gasToken,
      aliceEoa,
      nocturneWalletSDKAlice.signer.canonicalStealthAddress(),
      [GAS_FAUCET_DEFAULT_AMOUNT]
    );
    await fillSubtreeBatch();

    console.log("encode reserve erc721 action");
    const erc721ReserveCalldata =
      SimpleERC721Token__factory.createInterface().encodeFunctionData(
        "reserveToken",
        // mint a ERC721 token directly to the teller contract
        [handler.address, erc721Asset.id]
      );

    console.log("encode reserve erc1155 action");
    const erc1155ReserveCalldata =
      SimpleERC1155Token__factory.createInterface().encodeFunctionData(
        "reserveTokens",
        // mint ERC1155_TOKEN_AMOUNT of ERC1155 token directly to the teller contract
        [handler.address, erc1155Asset.id, PLUTOCRACY_AMOUNT]
      );

    // unwrap 1 erc20 to satisfy gas token requirement
    const operationRequest = new OperationRequestBuilder()
      .action(erc721.address, erc721ReserveCalldata)
      .action(erc1155.address, erc1155ReserveCalldata)
      .unwrap(gasTokenAsset, 1n)
      .gasPrice(GAS_PRICE)
      .chainId(BigInt((await provider.getNetwork()).chainId))
      .deadline(
        BigInt((await provider.getBlock("latest")).timestamp) + ONE_DAY_SECONDS
      )
      .build();

    const contractChecks = async () => {
      console.log("check for OperationProcessed event");
      const latestBlock = await provider.getBlockNumber();
      const events: OperationProcessedEvent[] = await queryEvents(
        teller,
        teller.filters.OperationProcessed(),
        0,
        latestBlock
      );

      expect(events[0].args.opProcessed).to.equal(true);
      expect(events[0].args.callSuccesses[0]).to.equal(true);
      expect(events[0].args.callSuccesses[1]).to.equal(true);
    };

    const offchainChecks = async () => {
      console.log("alice: Sync SDK post-operation");
      await nocturneWalletSDKAlice.sync();

      // Alice should have a note for minted ERC721 token
      const erc721NotesAlice = await nocturneDBAlice.getNotesForAsset(
        erc721Asset,
        { includeUncommitted: true }
      )!;
      expect(erc721NotesAlice.length).to.equal(1);

      // Alice should have a note for minted ERC1155 token
      const erc1155NotesAlice = await nocturneDBAlice.getNotesForAsset(
        erc1155Asset,
        { includeUncommitted: true }
      )!;
      expect(erc1155NotesAlice.length).to.equal(1);
    };

    await testE2E(
      operationRequest,
      contractChecks,
      offchainChecks,
      OperationStatus.EXECUTED_SUCCESS
    );
  });
});
