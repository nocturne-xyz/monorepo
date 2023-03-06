import "mocha";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { expect } from "chai";
import { NocturneSigner, generateRandomSpendingKey } from "../src/crypto";
import { range } from "../src/utils";
import { OperationRequestBuilder } from "../src";
import { OpPreparer } from "../src/opPreparer";
import { sortNotesByValue } from "../src/utils";
import {
  stablescam,
  setup,
  shitcoin,
  encodedShitcoin,
  monkey,
  ponzi,
  plutocracy,
  encodedPonzi,
  encodedStablescam,
  encodedPlutocracy,
  getDummyHex,
  testGasAssets,
} from "./utils";
import { OpRequestPreparer } from "../src/opRequestPreparer";

chai.use(chaiAsPromised);

describe("gatherNotes", () => {
  it("throws an error when attempting to overspend", async () => {
    const [notesDB, merkleProver, signer] = await setup([100n], [stablescam]);
    const opPreparer = new OpPreparer(notesDB, merkleProver, signer);

    // attempt request 1000 tokens, more than the user owns
    // expect to throw error
    await expect(
      //@ts-ignore
      opPreparer.gatherNotes(1000n, stablescam, notesDB)
    ).to.be.rejectedWith("Attempted to spend more funds than owned");
  });

  it("gathers the minimum notes for amount < smallest note", async () => {
    const [notesDB, merkleProver, signer] = await setup(
      [100n, 10n],
      range(2).map((_) => stablescam)
    );
    const opPreparer = new OpPreparer(notesDB, merkleProver, signer);

    // expect to get one note - the 10 token note
    //@ts-ignore
    const notes = await opPreparer.gatherNotes(5n, stablescam, notesDB);
    expect(notes).to.have.lengthOf(1);
    expect(notes[0].value).to.equal(10n);
  });

  it("gathers the minimum amount of notes for amount requiring all notes", async () => {
    const [notesDB, merkleProver, signer] = await setup(
      [30n, 20n, 10n],
      range(3).map((_) => stablescam)
    );
    const opPreparer = new OpPreparer(notesDB, merkleProver, signer);

    // attempt to request 55 tokens
    // expect to get all three notes
    //@ts-ignore
    const notes = await opPreparer.gatherNotes(55n, stablescam, notesDB);
    expect(notes).to.have.lengthOf(3);

    const sortedNotes = sortNotesByValue(notes);
    expect(sortedNotes[0].value).to.equal(10n);
    expect(sortedNotes[1].value).to.equal(20n);
    expect(sortedNotes[2].value).to.equal(30n);
  });

  it("gathers minimum amount of notes for a realistic-ish example", async () => {
    const [notesDB, merkleProver, signer] = await setup(
      [1000n, 51n, 19n, 3n, 3n, 2n, 1n, 1n, 1n],
      range(9).map((_) => stablescam)
    );
    const opPreparer = new OpPreparer(notesDB, merkleProver, signer);

    // attempt to spend 23 tokens
    // expect to get 4 notes - 19, 2, 1, 1
    // in principle, we could get away with 3 notes - 19, 3, 1. But we also want to
    // utilize small notes. this is what we'd expect to get from the algorithm
    //@ts-ignore
    const notes = await opPreparer.gatherNotes(23n, stablescam, notesDB);
    expect(notes).to.have.lengthOf(4);

    const sortedNotes = sortNotesByValue(notes);
    expect(sortedNotes[0].value).to.equal(1n);
    expect(sortedNotes[1].value).to.equal(1n);
    expect(sortedNotes[2].value).to.equal(2n);
    expect(sortedNotes[3].value).to.equal(19n);

    // check to ensure the 1 token notes are different
    expect(sortedNotes[0].nonce).to.not.equal(sortedNotes[1].nonce);
  });
});

describe("prepareOperation", async () => {
  it("works for an operation request with 1 action, 1 unrwap, 0 payments, no params set", async () => {
    const [nocturneDB, merkleProver, signer, walletContract] = await setup(
      [100n, 10n],
      [shitcoin, shitcoin]
    );
    const opPreparer = new OpPreparer(notesDB, merkleProver, signer);
    const opRequestPreparer = new OpRequestPreparer(
      walletContract,
      opPreparer,
      signer,
      notesDB,
      testGasAssets
    );

    const builder = new OperationRequestBuilder();
    const opRequest = builder
      .action("0x1234", getDummyHex(0))
      .unwrap(shitcoin, 3n)
      .refundAsset(shitcoin)
      .maxNumRefunds(1n)
      .gas({
        executionGasLimit: 1_000_000n,
        gasPrice: 0n,
      })
      .build();

    const gasCompAccountedOpRequest =
      await opRequestPreparer.prepareOperationRequest(opRequest);
    const op = await opPreparer.prepareOperation(gasCompAccountedOpRequest);
    expect(op).to.not.be.null;
    expect(op).to.not.be.undefined;

    expect(op.encodedRefundAssets.length).to.equal(1);
    expect(op.encodedRefundAssets[0]).to.eql(encodedShitcoin);

    expect(op.actions.length).to.equal(1);
    expect(op.actions[0]).to.eql({
      contractAddress: "0x1234",
      encodedFunction: getDummyHex(0),
    });

    // expect to have 1 joinsplit
    expect(op.joinSplits.length).to.equal(1);
  });

  it("works for an operation request with 1 action, 1 unwrap, 1 payment, no params set", async () => {
    const [nocturneDB, merkleProver, signer, walletContract] = await setup(
      [100n, 10n],
      [shitcoin, shitcoin]
    );
    const opPreparer = new OpPreparer(notesDB, merkleProver, signer);
    const opRequestPreparer = new OpRequestPreparer(
      walletContract,
      opPreparer,
      signer,
      notesDB,
      testGasAssets
    );

    const receiverSk = generateRandomSpendingKey();
    const receiverSigner = new NocturneSigner(receiverSk);
    const receiver = receiverSigner.canonicalAddress();

    const builder = new OperationRequestBuilder();
    const opRequest = builder
      .action("0x1234", getDummyHex(0))
      .unwrap(shitcoin, 3n)
      .refundAsset(shitcoin)
      .maxNumRefunds(1n)
      .confidentialPayment(shitcoin, 1n, receiver)
      .gas({
        executionGasLimit: 1_000_00n,
        gasPrice: 0n,
      })
      .build();

    const gasCompAccountedOperationRequest =
      await opRequestPreparer.prepareOperationRequest(opRequest);
    const op = await opPreparer.prepareOperation(
      gasCompAccountedOperationRequest
    );
    expect(op).to.not.be.null;
    expect(op).to.not.be.undefined;

    expect(op.encodedRefundAssets.length).to.equal(1);
    expect(op.encodedRefundAssets[0]).to.eql(encodedShitcoin);

    expect(op.actions.length).to.equal(1);
    expect(op.actions[0]).to.eql({
      contractAddress: "0x1234",
      encodedFunction: getDummyHex(0),
    });

    // expect to have 1 joinsplit
    expect(op.joinSplits.length).to.equal(1);
  });

  it("works for an operation request with 1 action, 1 unwrap, 0 payments, all params set", async () => {
    const [nocturneDB, merkleProver, signer, walletContract] = await setup(
      [100n, 10n],
      [shitcoin, shitcoin]
    );
    const opPreparer = new OpPreparer(notesDB, merkleProver, signer);
    const opRequestPreparer = new OpRequestPreparer(
      walletContract,
      opPreparer,
      signer,
      notesDB,
      testGasAssets
    );
    const refundAddr = signer.generateRandomStealthAddress();

    const builder = new OperationRequestBuilder();
    const opRequest = builder
      .action("0x1234", getDummyHex(0))
      .unwrap(shitcoin, 3n)
      .refundAsset(shitcoin)
      .maxNumRefunds(1n)
      .refundAddr(refundAddr)
      .gas({
        executionGasLimit: 20n,
        gasPrice: 0n,
      })
      .maxNumRefunds(1n)
      .build();

    const gasCompAccountedOperationRequest =
      await opRequestPreparer.prepareOperationRequest(opRequest);
    const op = await opPreparer.prepareOperation(
      gasCompAccountedOperationRequest
    );
    expect(op).to.not.be.null;
    expect(op).to.not.be.undefined;

    expect(op.refundAddr).to.eql(refundAddr);
    expect(op.executionGasLimit).to.equal(20n);
    expect(op.gasPrice).to.equal(0n);

    expect(op.encodedRefundAssets.length).to.equal(1);
    expect(op.encodedRefundAssets[0]).to.eql(encodedShitcoin);

    expect(op.actions.length).to.equal(1);
    expect(op.actions[0]).to.eql({
      contractAddress: "0x1234",
      encodedFunction: getDummyHex(0),
    });

    // expect to have 1 joinsplit
    expect(op.joinSplits.length).to.equal(1);
  });

  it("works for an operation request with 0 actions, 0 unwraps, 2 payments, no params set", async () => {
    const [nocturneDB, merkleProver, signer, walletContract] = await setup(
      [100n, 10n],
      [shitcoin, stablescam]
    );
    const opPreparer = new OpPreparer(notesDB, merkleProver, signer);
    const opRequestPreparer = new OpRequestPreparer(
      walletContract,
      opPreparer,
      signer,
      notesDB,
      testGasAssets
    );

    const receivers = range(2)
      .map((_) => generateRandomSpendingKey())
      .map((sk) => new NocturneSigner(sk))
      .map((signer) => signer.canonicalAddress());

    const builder = new OperationRequestBuilder();
    const opRequest = builder
      .confidentialPayment(shitcoin, 1n, receivers[0])
      .confidentialPayment(stablescam, 2n, receivers[1])
      .gas({
        executionGasLimit: 1_000_000n,
        gasPrice: 0n,
      })
      .maxNumRefunds(1n)
      .build();

    const gasCompAccountedOperationRequest =
      await opRequestPreparer.prepareOperationRequest(opRequest);
    const op = await opPreparer.prepareOperation(
      gasCompAccountedOperationRequest
    );
    expect(op).to.not.be.null;
    expect(op).to.not.be.undefined;

    expect(op.encodedRefundAssets.length).to.equal(0);
    expect(op.actions.length).to.equal(0);

    // expect to have 2 joinsplits bc we have 2 payments for 2 different assets
    expect(op.joinSplits.length).to.equal(2);
  });

  it("works for an operation request with 2 actions, 5 unwraps, 3 payments, 5 different assets, refund addr set", async () => {
    const [nocturneDB, merkleProver, signer, walletContract] = await setup(
      [1000n, 1000n, 1000n, 1n, 1000n],
      [shitcoin, ponzi, stablescam, monkey, plutocracy]
    );
    const opPreparer = new OpPreparer(notesDB, merkleProver, signer);
    const opRequestPreparer = new OpRequestPreparer(
      walletContract,
      opPreparer,
      signer,
      notesDB,
      testGasAssets
    );

    const receivers = range(3)
      .map((_) => generateRandomSpendingKey())
      .map((sk) => new NocturneSigner(sk))
      .map((signer) => signer.canonicalAddress());

    const refundAddr = signer.generateRandomStealthAddress();

    const builder = new OperationRequestBuilder();
    const opRequest = builder
      .action("0x1234", getDummyHex(0))
      .action("0x1234", getDummyHex(1))
      .unwrap(shitcoin, 3n)
      .unwrap(ponzi, 69n)
      .unwrap(stablescam, 420n)
      .unwrap(plutocracy, 100n)
      .confidentialPayment(shitcoin, 1n, receivers[0])
      .confidentialPayment(ponzi, 2n, receivers[1])
      .confidentialPayment(monkey, 1n, receivers[2])
      .refundAsset(shitcoin)
      .refundAsset(ponzi)
      .refundAsset(stablescam)
      .refundAsset(plutocracy)
      .refundAddr(refundAddr)
      .maxNumRefunds(4n)
      .gas({
        executionGasLimit: 1_000_000n,
        gasPrice: 0n,
      })
      .build();

    const gasCompAccountedOpRequest =
      await opRequestPreparer.prepareOperationRequest(opRequest);
    const op = await opPreparer.prepareOperation(gasCompAccountedOpRequest);
    expect(op).to.not.be.null;
    expect(op).to.not.be.undefined;

    expect(op.refundAddr).to.eql(refundAddr);
    expect(op.encodedRefundAssets.length).to.equal(4);
    expect(op.encodedRefundAssets[0]).to.eql(encodedShitcoin);
    expect(op.encodedRefundAssets[1]).to.eql(encodedPonzi);
    expect(op.encodedRefundAssets[2]).to.eql(encodedStablescam);
    expect(op.encodedRefundAssets[3]).to.eql(encodedPlutocracy);

    expect(op.actions.length).to.equal(2);
    expect(op.actions[0]).to.eql({
      contractAddress: "0x1234",
      encodedFunction: getDummyHex(0),
    });
    expect(op.actions[1]).to.eql({
      contractAddress: "0x1234",
      encodedFunction: getDummyHex(1),
    });

    // expect to have 5 joinsplits bc we have 5 different assets
    // and for each asset, there is at most 1 payment
    expect(op.joinSplits.length).to.equal(5);
  });

  it("Prepares operation with gas tokens of already unwrapping asset", async () => {
    const [notesDB, merkleProver, signer, walletContract] = await setup(
      [500_000n, 500_000n, 500_000n],
      [shitcoin, shitcoin, shitcoin]
    );
    const opPreparer = new OpPreparer(notesDB, merkleProver, signer);
    const opRequestPreparer = new OpRequestPreparer(
      walletContract,
      opPreparer,
      signer,
      notesDB,
      testGasAssets
    );

    const builder = new OperationRequestBuilder();
    const opRequest = builder
      .action("0x1234", getDummyHex(0))
      .unwrap(shitcoin, 3n)
      .refundAsset(shitcoin)
      .maxNumRefunds(1n)
      .gas({
        executionGasLimit: 1_000_000n,
        gasPrice: 1n,
      })
      .build();

    // Total required = executionGas + unwrapValue + (joinsplitGas + refundGas)
    // Total required = 1_000_000 + 3 + 170_000 + 80_000
    const gasCompAccountedOperationRequest =
      await opRequestPreparer.prepareOperationRequest(opRequest);
    const op = await opPreparer.prepareOperation(
      gasCompAccountedOperationRequest
    );

    // expect to have 2 joinsplits (combine two 500k notes then use last 500k note)
    expect(op.joinSplits.length).to.equal(2);
    expect(
      op.joinSplits[0].publicSpend + op.joinSplits[1].publicSpend
    ).to.equal(1_250_003n);
  });

  it("Prepares operation with gas tokens of separate gas asset given not enough of first", async () => {
    const [notesDB, merkleProver, signer, walletContract] = await setup(
      [500_000n, 500_000n, 500_000n, 2_000_000n],
      [shitcoin, shitcoin, shitcoin, stablescam]
    );
    const opPreparer = new OpPreparer(notesDB, merkleProver, signer);
    const opRequestPreparer = new OpRequestPreparer(
      walletContract,
      opPreparer,
      signer,
      notesDB,
      testGasAssets
    );

    const builder = new OperationRequestBuilder();
    const opRequest = builder
      .action("0x1234", getDummyHex(0))
      .unwrap(shitcoin, 100_000n)
      .refundAsset(shitcoin)
      .maxNumRefunds(1n)
      .gas({
        // Exceeds shitcoin balance, forces us to use stablescam
        executionGasLimit: 1_600_000n,
        gasPrice: 1n,
      })
      .build();

    const gasCompAccountedOperationRequest =
      await opRequestPreparer.prepareOperationRequest(opRequest);
    const op = await opPreparer.prepareOperation(
      gasCompAccountedOperationRequest
    );

    // Expect to have 2 joinsplits (one with 100_000 request of shitcoin, other
    // of > 1_600_000 of stablescam as gas token)
    expect(op.joinSplits.length).to.equal(2);
    expect(op.joinSplits[0].oldNoteA.asset).to.eql(shitcoin);
    expect(op.joinSplits[0].publicSpend).to.eql(100_000n);
    expect(op.joinSplits[1].oldNoteA.asset).to.eql(stablescam);
    expect(Number(op.joinSplits[1].publicSpend)).to.gte(1_600_000);
  });
});

// TODO unit test for prepareJoinSplits that actually inspects the PreProofJoinSplits coming out
