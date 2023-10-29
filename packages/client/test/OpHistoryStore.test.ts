import "mocha";
import { expect } from "chai";
import { OpHistoryStore } from "../src/OpHistoryStore";
import {
  Address,
  AssetType,
  InMemoryKVStore,
  KVStore,
  OperationStatus,
  OperationTrait,
  SubmittableOperationWithNetworkInfo,
  range,
  zip,
} from "@nocturne-xyz/core";
import { OperationMetadata, OperationMetadataItem } from "../src";

describe("OpHistoryStore", () => {
  let kv: KVStore;
  let opHistoryStore: OpHistoryStore;

  beforeEach(() => {
    kv = new InMemoryKVStore();
    opHistoryStore = new OpHistoryStore(kv);
  });

  it("stores history", async () => {
    // some ops
    const ops = range(10).map(() => randomOp());
    const metadatas = range(10).map(() => randomMetadata());

    for (const [op, metadata] of zip(ops, metadatas)) {
      await opHistoryStore.push(op, metadata);
    }

    let history = await opHistoryStore.getHistory();
    expect(history.length).to.equal(metadatas.length);
    expect(history.map((h) => h.op)).to.eql(ops);
    expect(history.map((h) => h.metadata)).to.eql(metadatas);

    // more ops
    const moreOps = range(10).map(() => randomOp());
    const moreMetadatas = range(10).map(() => randomMetadata());
    for (const [op, metadata] of zip(moreOps, moreMetadatas)) {
      await opHistoryStore.push(op, metadata);
    }

    history = await opHistoryStore.getHistory();
    expect(history.length).to.equal(metadatas.length + moreMetadatas.length);
    expect(history.map((h) => h.op)).to.eql([...ops, ...moreOps]);
    expect(history.map((h) => h.metadata)).to.eql([
      ...metadatas,
      ...moreMetadatas,
    ]);
  });

  it("gets record for op", async () => {
    const op = randomOp();
    const digest = OperationTrait.computeDigest(op);
    const metadata = randomMetadata();

    await opHistoryStore.push(op, metadata);
    const record = await opHistoryStore.getHistoryRecord(digest);

    expect(record).to.not.be.undefined;
    expect(record!.op).to.eql(op);
    expect(record!.metadata).to.not.be.undefined;
    expect(record!.metadata).to.eql(metadata);
    expect(record!.status).to.be.undefined;
  });

  it("sets op status", async () => {
    const op = randomOp();
    const digest = OperationTrait.computeDigest(op);
    const metadata = randomMetadata();

    await opHistoryStore.push(op, metadata);
    await opHistoryStore.setStatus(digest, OperationStatus.IN_BATCH);

    const record = await opHistoryStore.getHistoryRecord(digest);
    expect(record).to.not.be.undefined;
    expect(record!.status).to.equal(OperationStatus.IN_BATCH);
  });
});

function randomOp(): SubmittableOperationWithNetworkInfo {
  return {
    networkInfo: {
      chainId: 1n,
      tellerContract: "0x72Ad2Ef391e870A94C3A849727f1A5C27E426195",
    },
    refundAddr: {
      h1: randomBigint(),
      h2: randomBigint(),
    },
    actions: [],
    encodedGasAsset: {
      encodedAssetAddr: 0n,
      encodedAssetId: 0n,
    },
    gasAssetRefundThreshold: 0n,
    executionGasLimit: 0n,
    gasPrice: 0n,
    deadline: 0n,
    atomicActions: false,

    pubJoinSplits: [],
    confJoinSplits: [],
    trackedAssets: [],
  };
}

function flipCoin(): boolean {
  return Math.random() < 0.5;
}

function randomAddress(): Address {
  return (
    "0x" +
    range(20)
      .map(() => Math.floor(Math.random() * 16).toString(16))
      .join("")
  );
}

function randomBigint(): bigint {
  return BigInt(Math.floor(Math.random() * 1000000));
}

function randomMetadata(): OperationMetadata {
  const numItems = Math.floor(Math.random() * 10);
  const items: OperationMetadataItem[] = range(numItems).map(() => {
    const isAction = flipCoin();
    if (isAction) {
      return {
        type: "Action",
        actionType: "Transfer",
        recipientAddress: randomAddress(),
        erc20Address: randomAddress(),
        amount: randomBigint(),
      };
    } else {
      return {
        type: "ConfidentialPayment",
        recipient: {
          x: randomBigint(),
          y: randomBigint(),
        },
        asset: {
          assetAddr: randomAddress(),
          id: randomBigint(),
          assetType: AssetType.ERC20,
        },
        amount: randomBigint(),
      };
    }
  });

  return { items };
}
