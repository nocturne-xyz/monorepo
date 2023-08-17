import "mocha";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { expect } from "chai";
import {
  NocturneSigner,
  StealthAddressTrait,
  generateRandomSpendingKey,
} from "../src/crypto";
import { range } from "../src/utils";
import { AssetTrait, OpRequestBuilder } from "../src";
import { prepareOperation, __private } from "../src/prepareOperation";
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
  DUMMY_CONTRACT_ADDR,
} from "./utils";
import { handleGasForOperationRequest } from "../src/opRequestGas";
import { MockEthToTokenConverter } from "../src/conversion";

const { gatherNotes } = __private;

chai.use(chaiAsPromised);

describe("gatherNotes", () => {
  it("throws an error when attempting to overspend", async () => {
    const [nocturneDB] = await setup([100n], [stablescam]);

    // attempt request 1000 tokens, more than the user owns
    // expect to throw error
    await expect(gatherNotes(nocturneDB, 1000n, stablescam)).to.be.rejectedWith(
      "attempted to spend more funds than owned"
    );
  });

  it("gathers the minimum notes for amount < smallest note", async () => {
    const [nocturneDB] = await setup(
      [100n, 10n],
      range(2).map((_) => stablescam)
    );
    // expect to get one note - the 10 token note
    const notes = await gatherNotes(nocturneDB, 5n, stablescam);
    expect(notes).to.have.lengthOf(1);
    expect(notes[0].value).to.equal(10n);
  });

  it("gathers the minimum amount of notes for amount requiring all notes", async () => {
    const [nocturneDB] = await setup(
      [30n, 20n, 10n],
      range(3).map((_) => stablescam)
    );

    // attempt to request 55 tokens
    // expect to get all three notes
    const notes = await gatherNotes(nocturneDB, 55n, stablescam);
    expect(notes).to.have.lengthOf(3);

    const sortedNotes = sortNotesByValue(notes);
    expect(sortedNotes[0].value).to.equal(10n);
    expect(sortedNotes[1].value).to.equal(20n);
    expect(sortedNotes[2].value).to.equal(30n);
  });

  it("gathers minimum amount of notes for a realistic-ish example", async () => {
    const [nocturneDB] = await setup(
      [1000n, 51n, 19n, 3n, 3n, 2n, 1n, 1n, 1n],
      range(9).map((_) => stablescam)
    );

    // attempt to spend 23 tokens
    // expect to get 4 notes - 19, 2, 1, 1
    // in principle, we could get away with 3 notes - 19, 3, 1. But we also want to
    // utilize small notes. this is what we'd expect to get from the algorithm
    //@ts-ignore
    const notes = await gatherNotes(nocturneDB, 23n, stablescam);
    expect(notes).to.have.lengthOf(4);

    const sortedNotes = sortNotesByValue(notes);
    expect(sortedNotes[0].value).to.equal(1n);
    expect(sortedNotes[1].value).to.equal(1n);
    expect(sortedNotes[2].value).to.equal(2n);
    expect(sortedNotes[3].value).to.equal(19n);

    // check to ensure the 1 token notes are different
    expect(sortedNotes[0].nonce).to.not.equal(sortedNotes[1].nonce);
  });

  it("ignores uncommitted notes", async () => {
    // insert 4 notes, but the last one is uncommitted
    const [nocturneDB] = await setup(
      [5n, 15n, 10n, 30n],
      range(4).map((_) => stablescam),
      {
        latestCommittedMerkleIndex: 2,
      }
    );

    // get notes for 30 tokens
    // we should not get the 30 token note, since it is uncommitted
    // instead, we should get the other three notes
    const notes = await gatherNotes(nocturneDB, 30n, stablescam);
    expect(notes).to.have.lengthOf(3);

    const sortedNotes = sortNotesByValue(notes);
    expect(sortedNotes[0].value).to.equal(5n);
    expect(sortedNotes[1].value).to.equal(10n);
    expect(sortedNotes[2].value).to.equal(15n);
  });

  it("ignores notes with optimistic NF records", async () => {
    const [nocturneDB] = await setup(
      [30n, 15n, 10n, 10n],
      range(4).map((_) => stablescam)
    );

    // add optimistic NF records for the 30 token note at merkleIndex 0
    await nocturneDB.storeOptimisticRecords(
      0n,
      {
        expirationDate: Date.now() + 1_000_000,
        merkleIndices: [0],
        metadata: {
          items: [
            {
              type: "Action",
              actionType: "Transfer",
              recipientAddress: "0xdeadbeef",
              erc20Address: shitcoin.assetAddr,
              amount: 10n,
            },
          ],
        },
      },
      [{ nullifier: 420n }]
    );

    // gather notes to spend 30 tokens total
    // we should not get the 30 token note, since it has an optimistic NF record
    // instead, we should get the other three notes
    const notes = await gatherNotes(nocturneDB, 30n, stablescam);
    expect(notes).to.have.lengthOf(3);
  });
});

describe("prepareOperation", async () => {
  it("works for an operation request with 1 action, 1 unrwap, 0 payments, no params set", async () => {
    const [nocturneDB, merkleProver, signer, handlerContract] = await setup(
      [100n, 10n],
      [shitcoin, shitcoin]
    );
    const deps = {
      handlerContract,
      merkle: merkleProver,
      viewer: signer,
      gasAssets: testGasAssets,
      tokenConverter: new MockEthToTokenConverter(),
      db: nocturneDB,
    };

    const builder = new OpRequestBuilder({
      chainId: 1n,
      tellerContract: DUMMY_CONTRACT_ADDR,
    });
    const opRequest = builder
      .action(DUMMY_CONTRACT_ADDR, getDummyHex(0))
      .unwrap(shitcoin, 3n)
      .refundAsset(shitcoin)
      .gas({
        executionGasLimit: 1_000_000n,
        gasPrice: 0n,
      })
      .deadline(1n)
      .build();

    const gasCompAccountedOpRequest = await handleGasForOperationRequest(
      deps,
      opRequest.request
    );
    const op = await prepareOperation(deps, gasCompAccountedOpRequest);
    expect(op).to.not.be.null;
    expect(op).to.not.be.undefined;

    expect(op.encodedRefundAssets.length).to.equal(1);
    expect(op.encodedRefundAssets[0]).to.eql(encodedShitcoin);

    expect(op.actions.length).to.equal(1);
    expect(op.actions[0]).to.eql({
      contractAddress: DUMMY_CONTRACT_ADDR,
      encodedFunction: getDummyHex(0),
    });

    // expect to have 1 joinsplit
    expect(op.joinSplits.length).to.equal(1);
  });

  it("works for an operation request with 1 action, 1 unwrap, 1 payment, no params set", async () => {
    const [nocturneDB, merkleProver, signer, handlerContract] = await setup(
      [100n, 10n],
      [shitcoin, shitcoin]
    );
    const deps = {
      handlerContract,
      merkle: merkleProver,
      viewer: signer,
      gasAssets: testGasAssets,
      tokenConverter: new MockEthToTokenConverter(),
      db: nocturneDB,
    };

    const receiverRk = generateRandomSpendingKey();
    const receiverSigner = new NocturneSigner(receiverRk);
    const receiver = receiverSigner.canonicalAddress();

    const builder = new OpRequestBuilder({
      chainId: 1n,
      tellerContract: DUMMY_CONTRACT_ADDR,
    });
    const opRequest = builder
      .action(DUMMY_CONTRACT_ADDR, getDummyHex(0))
      .unwrap(shitcoin, 3n)
      .refundAsset(shitcoin)
      .confidentialPayment(shitcoin, 1n, receiver)
      .gas({
        executionGasLimit: 1_000_00n,
        gasPrice: 0n,
      })
      .deadline(1n)
      .build();

    const gasCompAccountedOperationRequest = await handleGasForOperationRequest(
      deps,
      opRequest.request
    );
    const op = await prepareOperation(deps, gasCompAccountedOperationRequest);
    expect(op).to.not.be.null;
    expect(op).to.not.be.undefined;

    expect(op.encodedRefundAssets.length).to.equal(1);
    expect(op.encodedRefundAssets[0]).to.eql(encodedShitcoin);

    expect(op.actions.length).to.equal(1);
    expect(op.actions[0]).to.eql({
      contractAddress: DUMMY_CONTRACT_ADDR,
      encodedFunction: getDummyHex(0),
    });

    // expect to have 1 joinsplit
    expect(op.joinSplits.length).to.equal(1);
  });

  it("works for an operation request with 1 action, 1 unwrap, 0 payments, all params set", async () => {
    const [nocturneDB, merkleProver, signer, handlerContract] = await setup(
      [100n, 10n],
      [shitcoin, shitcoin]
    );
    const deps = {
      handlerContract,
      merkle: merkleProver,
      viewer: signer,
      gasAssets: testGasAssets,
      tokenConverter: new MockEthToTokenConverter(),
      db: nocturneDB,
    };
    const refundAddr = signer.generateRandomStealthAddress();

    const builder = new OpRequestBuilder({
      chainId: 1n,
      tellerContract: DUMMY_CONTRACT_ADDR,
    });
    const opRequest = builder
      .action(DUMMY_CONTRACT_ADDR, getDummyHex(0))
      .unwrap(shitcoin, 3n)
      .refundAsset(shitcoin)
      .refundAddr(refundAddr)
      .gas({
        executionGasLimit: 20n,
        gasPrice: 0n,
      })
      .deadline(1n)

      .build();

    const gasCompAccountedOperationRequest = await handleGasForOperationRequest(
      deps,
      opRequest.request
    );
    const op = await prepareOperation(deps, gasCompAccountedOperationRequest);
    expect(op).to.not.be.null;
    expect(op).to.not.be.undefined;

    expect(op.refundAddr).to.eql(StealthAddressTrait.compress(refundAddr));
    expect(op.executionGasLimit).to.equal(20n);
    expect(op.gasPrice).to.equal(0n);

    expect(op.encodedRefundAssets.length).to.equal(1);
    expect(op.encodedRefundAssets[0]).to.eql(encodedShitcoin);

    expect(op.actions.length).to.equal(1);
    expect(op.actions[0]).to.eql({
      contractAddress: DUMMY_CONTRACT_ADDR,
      encodedFunction: getDummyHex(0),
    });

    // expect to have 1 joinsplit
    expect(op.joinSplits.length).to.equal(1);
  });

  it("works for an operation request with 0 actions, 0 unwraps, 2 payments, no params set", async () => {
    const [nocturneDB, merkleProver, signer, handlerContract] = await setup(
      [100n, 10n],
      [shitcoin, stablescam]
    );
    const deps = {
      handlerContract,
      merkle: merkleProver,
      viewer: signer,
      gasAssets: testGasAssets,
      tokenConverter: new MockEthToTokenConverter(),
      db: nocturneDB,
    };

    const receivers = range(2)
      .map((_) => generateRandomSpendingKey())
      .map((sk) => new NocturneSigner(sk))
      .map((signer) => signer.canonicalAddress());

    const builder = new OpRequestBuilder({
      chainId: 1n,
      tellerContract: DUMMY_CONTRACT_ADDR,
    });
    const opRequest = builder
      .confidentialPayment(shitcoin, 1n, receivers[0])
      .confidentialPayment(stablescam, 2n, receivers[1])
      .gas({
        executionGasLimit: 1_000_000n,
        gasPrice: 0n,
      })
      .deadline(1n)

      .build();

    const gasCompAccountedOperationRequest = await handleGasForOperationRequest(
      deps,
      opRequest.request
    );
    const op = await prepareOperation(deps, gasCompAccountedOperationRequest);
    expect(op).to.not.be.null;
    expect(op).to.not.be.undefined;

    expect(op.encodedRefundAssets.length).to.equal(0);
    expect(op.actions.length).to.equal(0);

    // expect to have 2 joinsplits bc we have 2 payments for 2 different assets
    expect(op.joinSplits.length).to.equal(2);
  });

  it("works for an operation request with 2 actions, 5 unwraps, 3 payments, 5 different assets, refund addr set", async () => {
    const [nocturneDB, merkleProver, signer, handlerContract] = await setup(
      [1000n, 1000n, 1000n, 1n, 1000n],
      [shitcoin, ponzi, stablescam, monkey, plutocracy]
    );
    const deps = {
      handlerContract,
      merkle: merkleProver,
      viewer: signer,
      gasAssets: testGasAssets,
      tokenConverter: new MockEthToTokenConverter(),
      db: nocturneDB,
    };

    const receivers = range(3)
      .map((_) => generateRandomSpendingKey())
      .map((sk) => new NocturneSigner(sk))
      .map((signer) => signer.canonicalAddress());

    const refundAddr = signer.generateRandomStealthAddress();

    const builder = new OpRequestBuilder({
      chainId: 1n,
      tellerContract: DUMMY_CONTRACT_ADDR,
    });
    const opRequest = builder
      .action(DUMMY_CONTRACT_ADDR, getDummyHex(0))
      .action(DUMMY_CONTRACT_ADDR, getDummyHex(1))
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
        executionGasLimit: 1_000_000n,
        gasPrice: 0n,
      })
      .deadline(1n)
      .build();

    const gasCompAccountedOpRequest = await handleGasForOperationRequest(
      deps,
      opRequest.request
    );
    const op = await prepareOperation(deps, gasCompAccountedOpRequest);
    expect(op).to.not.be.null;
    expect(op).to.not.be.undefined;

    expect(op.refundAddr).to.eql(StealthAddressTrait.compress(refundAddr));
    expect(op.encodedRefundAssets.length).to.equal(4);
    expect(op.encodedRefundAssets[0]).to.eql(encodedShitcoin);
    expect(op.encodedRefundAssets[1]).to.eql(encodedPonzi);
    expect(op.encodedRefundAssets[2]).to.eql(encodedStablescam);
    expect(op.encodedRefundAssets[3]).to.eql(encodedPlutocracy);

    expect(op.actions.length).to.equal(2);
    expect(op.actions[0]).to.eql({
      contractAddress: DUMMY_CONTRACT_ADDR,
      encodedFunction: getDummyHex(0),
    });
    expect(op.actions[1]).to.eql({
      contractAddress: DUMMY_CONTRACT_ADDR,
      encodedFunction: getDummyHex(1),
    });

    // expect to have 5 joinsplits bc we have 5 different assets
    // and for each asset, there is at most 1 payment
    expect(op.joinSplits.length).to.equal(5);
  });

  it("sorts joinsplits contiguously by asset", async () => {
    const [nocturneDB, merkleProver, signer, handlerContract] = await setup(
      [1000n, 1000n, 1000n, 1000n, 1000n, 1000n, 1000n, 1000n],
      [shitcoin, ponzi, shitcoin, shitcoin, shitcoin, ponzi, ponzi, ponzi]
    );
    const deps = {
      handlerContract,
      merkle: merkleProver,
      viewer: signer,
      gasAssets: testGasAssets,
      tokenConverter: new MockEthToTokenConverter(),
      db: nocturneDB,
    };

    const builder = new OpRequestBuilder({
      chainId: 1n,
      tellerContract: DUMMY_CONTRACT_ADDR,
    });
    const opRequest = builder
      .action(DUMMY_CONTRACT_ADDR, getDummyHex(0))
      .action(DUMMY_CONTRACT_ADDR, getDummyHex(1))
      .unwrap(shitcoin, 4000n)
      .unwrap(ponzi, 4000n)
      .gas({
        executionGasLimit: 1_000_000n,
        gasPrice: 0n,
      })
      .build();

    const gasCompAccountedOpRequest = await handleGasForOperationRequest(
      deps,
      opRequest.request
    );
    const op = await prepareOperation(deps, gasCompAccountedOpRequest);

    expect(op.joinSplits.length).to.equal(4);
    expect(AssetTrait.decode(op.joinSplits[0].encodedAsset)).to.eql(shitcoin);
    expect(AssetTrait.decode(op.joinSplits[1].encodedAsset)).to.eql(shitcoin);
    expect(AssetTrait.decode(op.joinSplits[2].encodedAsset)).to.eql(ponzi);
    expect(AssetTrait.decode(op.joinSplits[3].encodedAsset)).to.eql(ponzi);
  });

  it("handles multiple joinSplit requests for the same asset", async () => {
    const [nocturneDB, merkleProver, signer, handlerContract] = await setup(
      [1000n, 2000n, 1000n, 2000n],
      [shitcoin, shitcoin, shitcoin, shitcoin]
    );
    const deps = {
      handlerContract,
      merkle: merkleProver,
      viewer: signer,
      gasAssets: testGasAssets,
      tokenConverter: new MockEthToTokenConverter(),
      db: nocturneDB,
    };

    const builder = new OpRequestBuilder({
      chainId: 1n,
      tellerContract: DUMMY_CONTRACT_ADDR,
    });
    const opRequest = builder
      .action(DUMMY_CONTRACT_ADDR, getDummyHex(0))
      .action(DUMMY_CONTRACT_ADDR, getDummyHex(1))
      .unwrap(shitcoin, 1000n)

      .gas({
        executionGasLimit: 1_000_000n,
        gasPrice: 0n,
      })
      .build();

    // Add one more joinsplit request for the same that adds up to total unwrap amount = 2000
    opRequest.request.joinSplitRequests.push(
      opRequest.request.joinSplitRequests[0]
    );

    const gasCompAccountedOpRequest = await handleGasForOperationRequest(
      deps,
      opRequest.request
    );
    const op = await prepareOperation(deps, gasCompAccountedOpRequest);

    expect(op.joinSplits.length).to.equal(2);
    expect(op.joinSplits[0].publicSpend).to.eql(1000n);
    expect(op.joinSplits[1].publicSpend).to.eql(1000n);

    // Ensure every note is only used once
    let merkleIndexSet = new Set<number>();
    op.joinSplits.forEach((js) => {
      // Ignoring merkle index B because we know those will be 0s since dummy notes (since no request > value of single js)
      expect(merkleIndexSet.has(js.oldNoteA.merkleIndex)).to.be.false;
      merkleIndexSet.add(js.oldNoteA.merkleIndex);
    });
  });
});

// TODO unit test for prepareJoinSplits that actually inspects the PreProofJoinSplits coming out
