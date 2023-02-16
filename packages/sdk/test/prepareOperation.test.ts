import "mocha";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { expect } from "chai";
import { StealthAddressTrait, NocturneSigner } from "../src/crypto";
import { OperationRequestBuilder, range, prepareOperation } from "../src/sdk";
import { __private } from "../src/sdk/prepareOperation";
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
} from "./utils";

const { gatherNotes, sortNotesByValue } = __private;

chai.use(chaiAsPromised);

describe("gatherNotes", () => {
  it("throws an error when attempting to overspend", async () => {
    const [notesDB, , ,] = await setup([100n], [stablescam]);

    // attempt request 1000 tokens, more than the user owns
    // expect to throw error
    await expect(gatherNotes(1000n, stablescam, notesDB)).to.be.rejectedWith(
      "Attempted to spend more funds than owned"
    );
  });

  it("gathers the minimum notes for amount < smallest note", async () => {
    const [notesDB, , ,] = await setup(
      [100n, 10n],
      range(2).map((_) => stablescam)
    );

    // expect to get one note - the 10 token note
    const notes = await gatherNotes(5n, stablescam, notesDB);
    expect(notes).to.have.lengthOf(1);
    expect(notes[0].value).to.equal(10n);
  });

  it("gathers the minimum amount of notes for amount requiring all notes", async () => {
    const [notesDB, , ,] = await setup(
      [30n, 20n, 10n],
      range(3).map((_) => stablescam)
    );

    // attempt to request 55 tokens
    // expect to get all three notes
    const notes = await gatherNotes(55n, stablescam, notesDB);
    expect(notes).to.have.lengthOf(3);

    const sortedNotes = sortNotesByValue(notes);
    expect(sortedNotes[0].value).to.equal(10n);
    expect(sortedNotes[1].value).to.equal(20n);
    expect(sortedNotes[2].value).to.equal(30n);
  });

  it("gathers minimum amount of notes for a realistic-ish example", async () => {
    const [notesdb, , ,] = await setup(
      [1000n, 51n, 19n, 3n, 3n, 2n, 1n, 1n, 1n],
      range(9).map((_) => stablescam)
    );

    // attempt to spend 23 tokens
    // expect to get 4 notes - 19, 2, 1, 1
    // in principle, we could get away with 3 notes - 19, 3, 1. But we also want to
    // utilize small notes. this is what we'd expect to get from the algorithm
    const notes = await gatherNotes(23n, stablescam, notesdb);
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
    const [notesDB, merkleProver, signer, walletContract] = await setup(
      [100n, 10n],
      [shitcoin, shitcoin]
    );

    const builder = new OperationRequestBuilder();
    const opRequest = builder
      .action("0x1234", getDummyHex(0))
      .unwrap(shitcoin, 3n)
      .refundAsset(shitcoin)
      .gas({
        verificationGasLimit: 1_000_000n,
        executionGasLimit: 1_000_000n,
        gasPrice: 1n,
      })
      .build();

    const op = await prepareOperation(
      opRequest,
      notesDB,
      merkleProver,
      signer,
      walletContract
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

  it("works for an operation request with 1 action, 1 unwrap, 1 payment, no params set", async () => {
    const [notesDB, merkleProver, signer, walletContract] = await setup(
      [100n, 10n],
      [shitcoin, shitcoin]
    );

    const receiverSigner = NocturneSigner.genRandom();
    const receiver = receiverSigner.getCanonicalAddress();

    const builder = new OperationRequestBuilder();
    const opRequest = builder
      .action("0x1234", getDummyHex(0))
      .unwrap(shitcoin, 3n)
      .refundAsset(shitcoin)
      .confidentialPayment(shitcoin, 1n, receiver)
      .gas({
        verificationGasLimit: 1_000_000n,
        executionGasLimit: 1_000_000n,
        gasPrice: 1n,
      })
      .build();

    const op = await prepareOperation(
      opRequest,
      notesDB,
      merkleProver,
      signer,
      walletContract
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
    const [notesDB, merkleProver, signer, walletContract] = await setup(
      [100n, 10n],
      [shitcoin, shitcoin]
    );
    const refundAddr = StealthAddressTrait.randomize(signer.address);

    const builder = new OperationRequestBuilder();
    const opRequest = builder
      .action("0x1234", getDummyHex(0))
      .unwrap(shitcoin, 3n)
      .refundAsset(shitcoin)
      .refundAddr(refundAddr)
      .gas({
        verificationGasLimit: 10n,
        executionGasLimit: 20n,
        gasPrice: 30n,
      })
      .maxNumRefunds(1n)
      .build();

    const op = await prepareOperation(
      opRequest,
      notesDB,
      merkleProver,
      signer,
      walletContract
    );
    expect(op).to.not.be.null;
    expect(op).to.not.be.undefined;

    expect(op.refundAddr).to.eql(refundAddr);
    expect(op.verificationGasLimit).to.equal(10n);
    expect(op.executionGasLimit).to.equal(20n);
    expect(op.gasPrice).to.equal(30n);

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
    const [notesDB, merkleProver, signer, walletContract] = await setup(
      [100n, 10n],
      [shitcoin, stablescam]
    );
    const receivers = range(2)
      .map((_) => NocturneSigner.genRandom())
      .map((signer) => signer.getCanonicalAddress());

    const builder = new OperationRequestBuilder();
    const opRequest = builder
      .confidentialPayment(shitcoin, 1n, receivers[0])
      .confidentialPayment(stablescam, 2n, receivers[1])
      .gas({
        verificationGasLimit: 1_000_000n,
        executionGasLimit: 1_000_000n,
        gasPrice: 1n,
      })
      .build();

    const op = await prepareOperation(
      opRequest,
      notesDB,
      merkleProver,
      signer,
      walletContract
    );
    expect(op).to.not.be.null;
    expect(op).to.not.be.undefined;

    expect(op.encodedRefundAssets.length).to.equal(0);
    expect(op.actions.length).to.equal(0);

    // expect to have 2 joinsplits bc we have 2 payments for 2 different assets
    expect(op.joinSplits.length).to.equal(2);
  });

  it("works for an operation request with 2 actions, 5 unwraps, 3 payments, 5 different assets, refund addr set", async () => {
    const [notesDB, merkleProver, signer, walletContract] = await setup(
      [1000n, 1000n, 1000n, 1n, 1000n],
      [shitcoin, ponzi, stablescam, monkey, plutocracy]
    );
    const receivers = range(3)
      .map((_) => NocturneSigner.genRandom())
      .map((signer) => signer.getCanonicalAddress());
    const refundAddr = StealthAddressTrait.randomize(signer.address);

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
      .gas({
        verificationGasLimit: 1_000_000n,
        executionGasLimit: 1_000_000n,
        gasPrice: 1n,
      })
      .build();

    const op = await prepareOperation(
      opRequest,
      notesDB,
      merkleProver,
      signer,
      walletContract
    );
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
});

// TODO unit test for prepareJoinSplits that actually inspects the PreProofJoinSplits coming out
