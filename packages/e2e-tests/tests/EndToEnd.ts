import { expect } from "chai";
import { setupTestDeployment, setupTestClient } from "../src/deploy";
import { KEYS_TO_WALLETS } from "../src/keys";
import { ethers } from "ethers";
import {
  DepositManager,
  SimpleERC1155Token__factory,
  SimpleERC20Token__factory,
  SimpleERC721Token__factory,
  Wallet,
  Vault,
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
  AssetType,
  JoinSplitProver,
  proveOperation,
} from "@nocturne-xyz/sdk";
import { sleep, submitAndProcessOperation } from "../src/utils";
import { depositFunds } from "../src/deposit";
import { OperationProcessedEvent } from "@nocturne-xyz/contracts/dist/src/Wallet";

// ALICE_UNWRAP_VAL + ALICE_TO_BOB_PRIV_VAL should be between PER_NOTE_AMOUNT
// and and 2 * PER_NOTE_AMOUNT
const PER_NOTE_AMOUNT = 100n * 1_000_000n;
const ALICE_UNWRAP_VAL = 120n * 1_000_000n;
const ALICE_TO_BOB_PUB_VAL = 100n * 1_000_000n;
const ALICE_TO_BOB_PRIV_VAL = 30n * 1_000_000n;

const ERC20_TOKEN_ID = 0n;
const ERC721_TOKEN_ID = 1n;
const ERC1155_TOKEN_ID = 2n;
const ERC1155_TOKEN_AMOUNT = 3n;

describe("Wallet, Context, Bundler, and SubtreeUpdater", async () => {
  let teardown: () => Promise<void>;

  let provider: ethers.providers.JsonRpcProvider;
  let aliceEoa: ethers.Wallet;
  let bobEoa: ethers.Wallet;

  let depositManager: DepositManager;
  let wallet: Wallet;
  let vault: Vault;
  let erc20Token: SimpleERC20Token;
  let erc721Token: SimpleERC721Token;
  let erc1155Token: SimpleERC1155Token;
  let nocturneDBAlice: NocturneDB;
  let nocturneWalletSDKAlice: NocturneWalletSDK;
  let nocturneDBBob: NocturneDB;
  let nocturneWalletSDKBob: NocturneWalletSDK;
  let joinSplitProver: JoinSplitProver;

  beforeEach(async () => {
    const testDeployment = await setupTestDeployment({
      include: {
        bundler: true,
        subtreeUpdater: true,
      },
    });

    ({ provider, teardown, wallet, vault, depositManager } = testDeployment);

    const [deployerEoa, _aliceEoa, _bobEoa] = KEYS_TO_WALLETS(provider);

    aliceEoa = _aliceEoa;
    bobEoa = _bobEoa;

    ({
      nocturneDBAlice,
      nocturneWalletSDKAlice,
      nocturneDBBob,
      nocturneWalletSDKBob,
      joinSplitProver,
    } = await setupTestClient(testDeployment.contractDeployment, provider));

    erc20Token = await new SimpleERC20Token__factory(deployerEoa).deploy();
    console.log("ERC20 erc20Token deployed at: ", erc20Token.address);
    erc721Token = await new SimpleERC721Token__factory(deployerEoa).deploy();
    console.log("ERC721 token deployed at: ", erc721Token.address);
    erc1155Token = await new SimpleERC1155Token__factory(deployerEoa).deploy();
    console.log("ERC1155 token deployed at: ", erc1155Token.address);
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

    const opRequest: OperationRequest = {
      ...operationRequest,
      gasPrice: 0n,
    };

    console.log("Create post-proof operation with NocturneWalletSDK");
    const preSign = await nocturneWalletSDKAlice.prepareOperation(opRequest);
    const signed = nocturneWalletSDKAlice.signOperation(preSign);
    const operation = await proveOperation(joinSplitProver, signed);

    await submitAndProcessOperation(operation);

    await contractChecks();
    await offchainChecks();
  }

  it(`Alice deposits two ${PER_NOTE_AMOUNT} token notes, unwraps ${ALICE_UNWRAP_VAL} tokens publicly, ERC20 transfers ${ALICE_TO_BOB_PUB_VAL} to Bob, and pays ${ALICE_TO_BOB_PRIV_VAL} to Bob privately`, async () => {
    console.log("Deposit funds and commit note commitments");
    await depositFunds(
      depositManager,
      erc20Token,
      aliceEoa,
      nocturneWalletSDKAlice.signer.generateRandomStealthAddress(),
      [PER_NOTE_AMOUNT, PER_NOTE_AMOUNT]
    );
    console.log("wait for subtreee update");
    await sleep(20_000);

    const erc20Asset: Asset = {
      assetType: AssetType.ERC20,
      assetAddr: erc20Token.address,
      id: ERC20_TOKEN_ID,
    };

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
      .action(erc20Token.address, encodedFunction)
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
      expect(events.length).to.equal(1);
      expect(events[0].args.opProcessed).to.equal(true);
      expect(events[0].args.callSuccesses[0]).to.equal(true);

      expect(
        (await erc20Token.balanceOf(await aliceEoa.getAddress())).toBigInt()
      ).to.equal(0n);
      expect(
        (await erc20Token.balanceOf(await bobEoa.getAddress())).toBigInt()
      ).to.equal(ALICE_TO_BOB_PUB_VAL);
      expect((await erc20Token.balanceOf(vault.address)).toBigInt()).to.equal(
        2n * PER_NOTE_AMOUNT - ALICE_TO_BOB_PUB_VAL
      );
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
    };

    await testE2E(operationRequest, contractChecks, offchainChecks);
  });

  it(`Alice mints an ERC721 and ERC1155 and receives them privately them as refunds to her Nocturne address`, async () => {
    console.log("Deposit funds and commit note commitments");
    await depositFunds(
      depositManager,
      erc20Token,
      aliceEoa,
      nocturneWalletSDKAlice.signer.canonicalStealthAddress(),
      [PER_NOTE_AMOUNT]
    );
    console.log("wait for subtreee update");
    await sleep(20_000);

    console.log("Encode reserve erc721 action");
    const erc721Asset: Asset = {
      assetType: AssetType.ERC721,
      assetAddr: erc721Token.address,
      id: ERC721_TOKEN_ID,
    };

    console.log("Encode reserve erc1155 action");
    const erc1155Asset: Asset = {
      assetType: AssetType.ERC1155,
      assetAddr: erc1155Token.address,
      id: ERC1155_TOKEN_ID,
    };

    const erc721EncodedFunction =
      SimpleERC721Token__factory.createInterface().encodeFunctionData(
        "reserveToken",
        // mint a ERC721 token directly to the wallet contract
        [wallet.address, ERC721_TOKEN_ID]
      );

    const erc1155EncodedFunction =
      SimpleERC1155Token__factory.createInterface().encodeFunctionData(
        "reserveTokens",
        // mint ERC1155_TOKEN_AMOUNT of ERC1155 token directly to the wallet contract
        [wallet.address, ERC1155_TOKEN_ID, ERC1155_TOKEN_AMOUNT]
      );

    // TODO: This is dummy gas token, needed to ensure contract has a
    // gas token joinsplit. In future PR, we need to have SDK auto-find
    // gas joinsplit.
    const erc20Asset: Asset = {
      assetType: AssetType.ERC20,
      assetAddr: erc20Token.address,
      id: ERC20_TOKEN_ID,
    };

    // unwrap 1 erc20 to satisfy gas token requirement
    const operationRequest = new OperationRequestBuilder()
      .action(erc721Token.address, erc721EncodedFunction)
      .action(erc1155Token.address, erc1155EncodedFunction)
      .unwrap(erc20Asset, 1n)
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
