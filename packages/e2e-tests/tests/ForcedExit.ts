import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { setupTestDeployment, setupTestClient } from "../src/deploy";
import { ethers } from "ethers";
import { DepositManager, Teller } from "@nocturne-xyz/contracts";
import { SimpleERC20Token } from "@nocturne-xyz/contracts/dist/src/SimpleERC20Token";
import {
  NocturneClient,
  NocturneDB,
  newOpRequestBuilder,
  queryEvents,
  Asset,
  JoinSplitProver,
  proveOperation,
  OperationRequestWithMetadata,
  NocturneSigner,
  signOperation,
  JoinSplitInfo,
} from "@nocturne-xyz/core";
import { ONE_DAY_SECONDS } from "../src/utils";
import { depositFundsMultiToken } from "../src/deposit";
import { OperationProcessedEvent } from "@nocturne-xyz/contracts/dist/src/Teller";
import { NocturneConfig } from "@nocturne-xyz/config";
import { Erc20Plugin } from "@nocturne-xyz/op-request-plugins";
import { computeJoinSplitInfo } from "@nocturne-xyz/core/src/proof/joinsplit";
import { BabyJubJub } from "@nocturne-xyz/crypto";

chai.use(chaiAsPromised);

interface TestE2EParams {
  senderClient: NocturneClient;
  opRequestWithMetadata: OperationRequestWithMetadata;
  success: boolean;
  contractChecks?: () => Promise<void>;
  offchainChecks?: () => Promise<void>;
}

const PER_NOTE_AMOUNT = 100n * 1_000_000n;

describe("forcedExit", async () => {
  let teardown: () => Promise<void>;
  let fillSubtreeBatch: () => Promise<void>;

  let provider: ethers.providers.JsonRpcProvider;
  let aliceEoa: ethers.Wallet;

  let config: NocturneConfig;
  let depositManager: DepositManager;
  let teller: Teller;
  let nocturneSignerAlice: NocturneSigner;
  let nocturneDBAlice: NocturneDB;
  let nocturneClientAlice: NocturneClient;
  let nocturneClientBob: NocturneClient;
  let joinSplitProver: JoinSplitProver;

  let erc20: SimpleERC20Token;
  let erc20Asset: Asset;

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
      aliceEoa,
      depositManager,
      fillSubtreeBatch,
    } = testDeployment);

    ({ erc20, erc20Asset, gasTokenAsset } = testDeployment.tokens);

    ({
      nocturneDBAlice,
      nocturneSignerAlice,
      nocturneClientAlice,
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
    senderClient,
    opRequestWithMetadata,
    success,
    contractChecks,
    offchainChecks,
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

    const joinSplitInfos: JoinSplitInfo[] = preSign.joinSplits.map((js) => {
      return computeJoinSplitInfo(
        senderClient.viewer,
        js.receiver,
        js.oldNoteA,
        js.oldNoteB,
        js.newNoteA,
        js.newNoteB
      );
    });

    console.log("proven operation:", operation);

    try {
      await teller.forcedExit({ operations: [operation] }, [joinSplitInfos]);
      expect(success).to.be.true;
    } catch (err) {
      console.error(err);
      expect(success).to.be.false;
      return;
    }

    await contractChecks?.();
    await offchainChecks?.();
  }

  it(`alice deposits four notes and forcedExits all of them`, async () => {
    console.log("deposit funds and commit note commitments");
    await depositFundsMultiToken(
      depositManager,
      [
        [
          erc20,
          [PER_NOTE_AMOUNT, PER_NOTE_AMOUNT, PER_NOTE_AMOUNT, PER_NOTE_AMOUNT],
        ],
      ],
      aliceEoa,
      nocturneClientAlice.viewer.generateRandomStealthAddress()
    );
    await fillSubtreeBatch();

    // Op request to send all 4 notes worth back to alice eoa
    const chainId = BigInt((await provider.getNetwork()).chainId);
    const opRequestWithMetadata = await newOpRequestBuilder(
      provider,
      chainId,
      config
    )
      .use(Erc20Plugin)
      .erc20Transfer(erc20.address, aliceEoa.address, PER_NOTE_AMOUNT * 4n)
      .refundAddr({
        h1X: BabyJubJub.BasePointAffine.x,
        h1Y: BabyJubJub.BasePointAffine.y,
        h2X: BabyJubJub.BasePointAffine.x,
        h2Y: BabyJubJub.BasePointAffine.y,
      })
      .gasPrice(0n)
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
      expect(events.length).to.equal(1);
      expect(events[0].args.opProcessed).to.equal(true);
      expect(events[0].args.callSuccesses[0]).to.equal(true);

      expect(
        (await erc20.balanceOf(await aliceEoa.getAddress())).toBigInt()
      ).to.equal(4n * PER_NOTE_AMOUNT);
      expect((await erc20.balanceOf(teller.address)).toBigInt()).to.equal(0n);
    };

    const offchainChecks = async () => {
      console.log("alice: Sync SDK post-operation");
      await nocturneClientAlice.sync();
      const updatedNotesAlice = await nocturneDBAlice.getNotesForAsset(
        erc20Asset,
        { includeUncommitted: true }
      )!;
      const nonZeroNotesAlice = updatedNotesAlice.filter((n) => n.value > 0n);

      // Alice has no more notes
      expect(nonZeroNotesAlice.length).to.equal(0);
    };

    await testE2E({
      senderClient: nocturneClientAlice,
      opRequestWithMetadata,
      success: true,
      contractChecks,
      offchainChecks,
    });
  });
});
