import { expect } from "chai";
import { setupNocturne } from "../src/deploy";
import * as JSON from "bigint-json-serialization";
import { KEYS_TO_WALLETS, KEYS } from "../src/keys";
import { startHardhatNetwork } from "../src/hardhat";
import Dockerode from "dockerode";
import * as compose from "docker-compose";
import { ethers } from "ethers";
import {
  SimpleERC1155Token__factory,
  SimpleERC20Token__factory,
  SimpleERC721Token__factory,
  Vault,
  Wallet,
} from "@nocturne-xyz/contracts";
import { SimpleERC20Token } from "@nocturne-xyz/contracts/dist/src/SimpleERC20Token";
import { SimpleERC721Token } from "@nocturne-xyz/contracts/dist/src/SimpleERC721Token";
import { SimpleERC1155Token } from "@nocturne-xyz/contracts/dist/src/SimpleERC1155Token";
import {
  Asset,
  AssetType,
  computeOperationDigest,
  NocturneContext,
  NotesDB,
  OperationRequest,
  OperationRequestBuilder,
  query,
  JoinSplitProver,
  proveOperation,
} from "@nocturne-xyz/sdk";
import { startSubtreeUpdater } from "../src/subtreeUpdater";
import { sleep } from "../src/utils";
import { BUNDLER_COMPOSE_CWD, startBundler } from "../src/bundler";
import { depositFunds } from "../src/deposit";
import { OperationProcessedEvent } from "@nocturne-xyz/contracts/dist/src/Wallet";
import * as fs from "fs";
import findWorkspaceRoot from "find-yarn-workspace-root";

const ROOT_DIR = findWorkspaceRoot()!;

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

const HH_URL = "http://localhost:8545";
const HH_FROM_DOCKER_URL = "http://host.docker.internal:8545";

const REDIS_URL = "redis://redis:6379";
const REDIS_PASSWORD = "baka";

describe("Wallet, Context, Bundler, and SubtreeUpdater", async () => {
  let docker: Dockerode;
  let hhContainer: Dockerode.Container;
  let subtreeUpdaterContainer: Dockerode.Container;

  let provider: ethers.providers.JsonRpcProvider;
  let deployerEoa: ethers.Wallet;
  let aliceEoa: ethers.Wallet;
  let bobEoa: ethers.Wallet;
  let subtreeUpdaterEoa: ethers.Wallet;
  let bundlerEoa: ethers.Wallet;

  let vault: Vault;
  let wallet: Wallet;
  let erc20Token: SimpleERC20Token;
  let erc721Token: SimpleERC721Token;
  let erc1155Token: SimpleERC1155Token;
  let notesDBAlice: NotesDB;
  let nocturneContextAlice: NocturneContext;
  let notesDBBob: NotesDB;
  let nocturneContextBob: NocturneContext;
  let joinSplitProver: JoinSplitProver;

  beforeEach(async () => {
    docker = new Dockerode();
    hhContainer = await startHardhatNetwork(docker, {
      blockTime: 3_000,
      keys: KEYS,
    });

    provider = new ethers.providers.JsonRpcProvider(HH_URL);
    [deployerEoa, aliceEoa, bobEoa, subtreeUpdaterEoa, bundlerEoa] =
      KEYS_TO_WALLETS(provider);

    ({
      vault,
      wallet,
      notesDBAlice,
      nocturneContextAlice,
      notesDBBob,
      nocturneContextBob,
      joinSplitProver,
    } = await setupNocturne(deployerEoa));

    erc20Token = await new SimpleERC20Token__factory(deployerEoa).deploy();
    console.log("ERC20 erc20Token deployed at: ", erc20Token.address);
    erc721Token = await new SimpleERC721Token__factory(deployerEoa).deploy();
    console.log("ERC721 token deployed at: ", erc721Token.address);
    erc1155Token = await new SimpleERC1155Token__factory(deployerEoa).deploy();
    console.log("ERC1155 token deployed at: ", erc1155Token.address);

    subtreeUpdaterContainer = await startSubtreeUpdater(docker, {
      walletAddress: wallet.address,
      rpcUrl: HH_FROM_DOCKER_URL,
      txSignerKey: subtreeUpdaterEoa.privateKey,
    });

    subtreeUpdaterContainer.logs(
      { follow: true, stdout: true, stderr: true },
      (err, stream) => {
        if (err) {
          console.error(err);
          return;
        }

        stream!.pipe(process.stdout);
      }
    );

    await startBundler({
      redisUrl: REDIS_URL,
      redisPassword: REDIS_PASSWORD,
      walletAddress: wallet.address,
      maxLatency: 1,
      rpcUrl: HH_FROM_DOCKER_URL,
      txSignerKey: bundlerEoa.privateKey,
    });
  });

  afterEach(async () => {
    await subtreeUpdaterContainer.stop();
    await subtreeUpdaterContainer.remove();
    await compose.down({
      cwd: BUNDLER_COMPOSE_CWD,
      commandOptions: [["--volumes"]],
    });
    await hhContainer.stop();
    await hhContainer.remove();

    // Delete redis-data folder so next test has clean run
    fs.rmdirSync(`${ROOT_DIR}/packages/bundler/redis-data`, {
      recursive: true,
    });
  });

  async function testE2E(
    operationRequest: OperationRequest,
    contractChecks: () => Promise<void>,
    offchainChecks: () => Promise<void>
  ): Promise<void> {
    console.log("Alice: Sync SDK notes manager");
    await nocturneContextAlice.syncNotes();

    console.log("Bob: Sync SDK notes manager");
    await nocturneContextBob.syncNotes();

    const preOpNotesAlice = await notesDBAlice.getAllNotes();
    console.log("Alice pre-op notes:", preOpNotesAlice);

    console.log("Alice: Sync SDK merkle prover");
    await nocturneContextAlice.syncLeaves();

    console.log("Bob: Sync SDK merkle prover");
    await nocturneContextBob.syncLeaves();

    const opRequest: OperationRequest = {
      ...operationRequest,
      gasPrice: 0n,
    };

    console.log("Create post-proof operation with NocturneContext");
    const preSign = await nocturneContextAlice.prepareOperation(opRequest);
    const signed = nocturneContextAlice.signOperation(preSign);
    const operation = await proveOperation(signed, joinSplitProver);

    console.log("Process bundle");
    var res = await fetch(`http://localhost:3000/relay`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(operation),
    });
    console.log("Bundler server response: ", await res.json());

    console.log("Sleeping for 20s while bundler submits...");
    await sleep(20_000);

    const operationDigest = computeOperationDigest(operation);
    var res = await fetch(
      `http://localhost:3000/operations/${operationDigest}`,
      {
        method: "GET",
      }
    );
    console.log(
      `Bundler marked operation ${operationDigest} ${JSON.stringify(
        await res.json()
      )}`
    );

    await sleep(5_000);

    await contractChecks();
    await offchainChecks();
  }

  it(`Alice deposits two ${PER_NOTE_AMOUNT} token notes, unwraps ${ALICE_UNWRAP_VAL} tokens publicly, ERC20 transfers ${ALICE_TO_BOB_PUB_VAL} to Bob, and pays ${ALICE_TO_BOB_PRIV_VAL} to Bob privately`, async () => {
    console.log("Deposit funds and commit note commitments");
    await depositFunds(
      wallet,
      vault,
      erc20Token,
      aliceEoa,
      nocturneContextAlice.signer.address,
      [PER_NOTE_AMOUNT, PER_NOTE_AMOUNT]
    );
    await sleep(15_000);

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
        nocturneContextBob.signer.canonAddress
      )
      .action(erc20Token.address, encodedFunction)
      .build();

    const contractChecks = async () => {
      console.log("Check for OperationProcessed event");
      const latestBlock = await provider.getBlockNumber();
      const events: OperationProcessedEvent[] = await query(
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
      console.log("Alice: Sync SDK notes manager post-operation");
      await nocturneContextAlice.syncNotes();
      const updatedNotesAlice = await notesDBAlice.getNotesFor(erc20Asset)!;
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

      console.log("Bob: Sync SDK notes manager post-operation");
      await nocturneContextBob.syncNotes();
      const updatedNotesBob = await notesDBBob.getNotesFor(erc20Asset)!;
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
      wallet,
      vault,
      erc20Token,
      aliceEoa,
      nocturneContextAlice.signer.address,
      [PER_NOTE_AMOUNT]
    );
    await sleep(15_000);

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
      const events: OperationProcessedEvent[] = await query(
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
      console.log("Alice: Sync SDK notes manager post-operation");
      await nocturneContextAlice.syncNotes();

      // Alice should have a note for minted ERC721 token
      const erc721NotesAlice = await notesDBAlice.getNotesFor(erc721Asset)!;
      expect(erc721NotesAlice.length).to.equal(1);

      // Alice should have a note for minted ERC1155 token
      const erc1155NotesAlice = await notesDBAlice.getNotesFor(erc1155Asset)!;
      expect(erc1155NotesAlice.length).to.equal(1);
    };

    await testE2E(operationRequest, contractChecks, offchainChecks);
  });
});
