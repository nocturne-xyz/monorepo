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
  Wallet,
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
} from "@nocturne-xyz/sdk";
import { sleep, submitAndProcessOperation } from "../src/utils";
import {
  depositFundsMultiToken,
  depositFundsSingleToken,
} from "../src/deposit";
import { OperationProcessedEvent } from "@nocturne-xyz/contracts/dist/src/Wallet";
import { deployERC1155, deployERC20, deployERC721 } from "../src/tokens";

chai.use(chaiAsPromised);

// ALICE_UNWRAP_VAL + ALICE_TO_BOB_PRIV_VAL should be between PER_NOTE_AMOUNT
// and and 2 * PER_NOTE_AMOUNT
const PER_NOTE_AMOUNT = 100n * 1_000_000n;
const ALICE_UNWRAP_VAL = 120n * 1_000_000n;
const ALICE_TO_BOB_PUB_VAL = 100n * 1_000_000n;
const ALICE_TO_BOB_PRIV_VAL = 30n * 1_000_000n;

// 10^9 (e.g. 10 gwei if this was eth)
const GAS_PRICE = 10n * 10n ** 9n;
// 10^9 gas
const GAS_FAUCET_DEFAULT_AMOUNT = 10n ** 9n * GAS_PRICE;

const PLUTOCRACY_AMOUNT = 3n;

const ONE_DAY_SECONDS = 60n * 60n * 24n;

describe("Wallet, Context, Bundler, and SubtreeUpdater", async () => {
  let teardown: () => Promise<void>;

  let provider: ethers.providers.JsonRpcProvider;
  let deployerEoa: ethers.Wallet;
  let aliceEoa: ethers.Wallet;
  let bobEoa: ethers.Wallet;
  let bundlerEoa: ethers.Wallet;

  let depositManager: DepositManager;
  let wallet: Wallet;
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
      wallet,
      handler,
      deployerEoa,
      aliceEoa,
      bobEoa,
      bundlerEoa,
      depositManager,
    } = testDeployment);

    [erc20, erc20Asset] = await deployERC20(deployerEoa);
    console.log("ERC20 'shitcoin' deployed at: ", erc20.address);

    [gasToken, gasTokenAsset] = await deployERC20(bundlerEoa);

    {
      let ctor;
      [erc721, ctor] = await deployERC721(deployerEoa);
      erc721Asset = ctor(0n);
      console.log("ERC721 'monkey' deployed at: ", erc721.address);
    }

    {
      let ctor;
      [erc1155, ctor] = await deployERC1155(deployerEoa);
      erc1155Asset = ctor(0n);
      console.log("ERC1155 'plutocracy' deployed at: ", erc1155.address);
    }

    ({
      nocturneDBAlice,
      nocturneWalletSDKAlice,
      nocturneDBBob,
      nocturneWalletSDKBob,
      joinSplitProver,
    } = await setupTestClient(testDeployment.contractDeployment, provider, {
      gasAssets: new Map([["GAS", gasTokenAsset.assetAddr]]),
    }));
  });

  afterEach(async () => {
    await teardown();
  });

  async function testE2E(
    operationRequest: OperationRequest,
    contractChecks: () => Promise<void>,
    offchainChecks: () => Promise<void>
  ): Promise<void> {
    console.log("Alice: Sync SDK");
    await nocturneWalletSDKAlice.sync();

    console.log("Bob: Sync SDK");
    await nocturneWalletSDKBob.sync();

    const preOpNotesAlice = await nocturneDBAlice.getAllNotes();
    console.log("Alice pre-op notes:", preOpNotesAlice);
    console.log(
      "Alice pre-op nextMerkleIndex",
      await nocturneDBAlice.nextMerkleIndex()
    );

    console.log("prepare, sign, and prove operation with NocturneWalletSDK");
    const preSign = await nocturneWalletSDKAlice.prepareOperation(
      operationRequest
    );
    const signed = nocturneWalletSDKAlice.signOperation(preSign);
    const operation = await proveOperation(joinSplitProver, signed);

    await submitAndProcessOperation(operation);
    // wait for subgraph to catch up
    await sleep(10_000);

    await contractChecks();
    await offchainChecks();
  }

  it("Bundler rejects operation with gas price < chain's gas price", async () => {
    console.log("Deposit funds");
    await depositFundsMultiToken(
      depositManager,
      [
        [erc20, [PER_NOTE_AMOUNT, PER_NOTE_AMOUNT]],
        [gasToken, [GAS_FAUCET_DEFAULT_AMOUNT]],
      ],
      aliceEoa,
      nocturneWalletSDKAlice.signer.generateRandomStealthAddress()
    );
    // wait for subgraph
    await sleep(3_000);

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
        async () => {}
      )
    ).to.eventually.be.rejectedWith("gas price too low");
  });

  it(`Alice deposits two ${PER_NOTE_AMOUNT} token notes, unwraps ${ALICE_UNWRAP_VAL} tokens publicly, ERC20 transfers ${ALICE_TO_BOB_PUB_VAL} to Bob, and pays ${ALICE_TO_BOB_PRIV_VAL} to Bob privately`, async () => {
    console.log("Deposit funds and commit note commitments");
    await depositFundsMultiToken(
      depositManager,
      [
        [erc20, [PER_NOTE_AMOUNT, PER_NOTE_AMOUNT]],
        [gasToken, [GAS_FAUCET_DEFAULT_AMOUNT]],
      ],
      aliceEoa,
      nocturneWalletSDKAlice.signer.generateRandomStealthAddress()
    );
    // wait for subgraph
    await sleep(3_000);

    console.log("Encode transfer erc20 action");
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
      console.log("Check for OperationProcessed event");
      const latestBlock = await provider.getBlockNumber();
      const events: OperationProcessedEvent[] = await queryEvents(
        wallet,
        wallet.filters.OperationProcessed(),
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
      expect((await erc20.balanceOf(wallet.address)).toBigInt()).to.equal(
        2n * PER_NOTE_AMOUNT - ALICE_TO_BOB_PUB_VAL
      );
      expect((await erc20.balanceOf(handler.address)).toBigInt()).to.equal(0n);
    };

    const offchainChecks = async () => {
      console.log("Alice: Sync SDK post-operation");
      await nocturneWalletSDKAlice.sync();
      const updatedNotesAlice = await nocturneDBAlice.getNotesForAsset(
        erc20Asset
      )!;
      const nonZeroNotesAlice = updatedNotesAlice.filter((n) => n.value > 0n);
      // alice should have two nonzero notes total
      expect(nonZeroNotesAlice.length).to.equal(2);
      console.log("Alice post-op notes:", nonZeroNotesAlice);

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

      console.log("Bob: Sync SDK post-operation");
      await nocturneWalletSDKBob.sync();
      const updatedNotesBob = await nocturneDBBob.getNotesForAsset(erc20Asset)!;
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

    await testE2E(operationRequest, contractChecks, offchainChecks);
  });

  it(`Alice mints an ERC721 and ERC1155 and receives them privately them as refunds to her Nocturne address`, async () => {
    console.log("Deposit funds and commit note commitments");
    await depositFundsSingleToken(
      depositManager,
      gasToken,
      aliceEoa,
      nocturneWalletSDKAlice.signer.canonicalStealthAddress(),
      [GAS_FAUCET_DEFAULT_AMOUNT]
    );
    // wait for subgraph
    await sleep(3_000);

    console.log("Encode reserve erc721 action");
    const erc721ReserveCalldata =
      SimpleERC721Token__factory.createInterface().encodeFunctionData(
        "reserveToken",
        // mint a ERC721 token directly to the wallet contract
        [handler.address, erc721Asset.id]
      );

    console.log("Encode reserve erc1155 action");
    const erc1155ReserveCalldata =
      SimpleERC1155Token__factory.createInterface().encodeFunctionData(
        "reserveTokens",
        // mint ERC1155_TOKEN_AMOUNT of ERC1155 token directly to the wallet contract
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
      console.log("Check for OperationProcessed event");
      const latestBlock = await provider.getBlockNumber();
      const events: OperationProcessedEvent[] = await queryEvents(
        wallet,
        wallet.filters.OperationProcessed(),
        0,
        latestBlock
      );

      expect(events[0].args.opProcessed).to.equal(true);
      expect(events[0].args.callSuccesses[0]).to.equal(true);
      expect(events[0].args.callSuccesses[1]).to.equal(true);
    };

    const offchainChecks = async () => {
      console.log("Alice: Sync SDK post-operation");
      await nocturneWalletSDKAlice.sync();

      // Alice should have a note for minted ERC721 token
      const erc721NotesAlice = await nocturneDBAlice.getNotesForAsset(
        erc721Asset
      )!;
      expect(erc721NotesAlice.length).to.equal(1);

      // Alice should have a note for minted ERC1155 token
      const erc1155NotesAlice = await nocturneDBAlice.getNotesForAsset(
        erc1155Asset
      )!;
      expect(erc1155NotesAlice.length).to.equal(1);
    };

    await testE2E(operationRequest, contractChecks, offchainChecks);
  });
});
