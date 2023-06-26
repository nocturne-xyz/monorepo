import "mocha";
import { expect } from "chai";
import { KV, zip } from "@nocturne-xyz/sdk";
import { LMDBKVStore } from "../src/lmdb";
import fs from "fs";

describe("LMDBKVStore", async () => {
  const kv = new LMDBKVStore({ path: "./test-db" });

  afterEach(async () => {
    await kv.clear();
  });

  after(async () => {
    fs.rmSync("./test-db", { recursive: true, force: true });
    await kv.close();
  });

  it("stores, gets, and removes primitive values in KV", async () => {
    await kv.putString("hello", "world");

    const val = await kv.getString("hello");
    expect(val).to.equal("world");

    await kv.remove("hello");
    expect(await kv.getString("hello")).to.be.undefined;

    await kv.putNumber("abc", 123);
    expect(await kv.getNumber("abc")).to.equal(123);

    await kv.putBigInt("Mehmet the conqueror", 1453n);
    expect(await kv.getBigInt("Mehmet the conqueror")).to.equal(1453n);
  });

  it("iterates over ranges", async () => {
    const rangeVals: KV[] = [
      ["a", "1"],
      ["b", "2"],
      ["c", "3"],
      ["d", "4"],
      ["e", "5"],
    ];

    await kv.putMany(rangeVals);

    let i = 0;
    for await (const [key, value] of await kv.iterRange("a", "e")) {
      expect(key).to.eql(rangeVals[i][0]);
      expect(value).to.eql(rangeVals[i][1]);
      i++;
    }

    // expect to have iterated over every key-value pair but the last
    expect(i).to.equal(rangeVals.length - 1);
  });

  it("iterates over prefixes", async () => {
    const prefixVals: KV[] = [
      ["aaa", "1"],
      ["aab", "2"],
      ["aac", "3"],
      ["aad", "4"],
      ["e", "5"],
    ];

    await kv.putMany(prefixVals);

    let i = 0;
    for await (const [key, value] of await kv.iterPrefix("a")) {
      expect(key).to.eql(prefixVals[i][0]);
      expect(value).to.eql(prefixVals[i][1]);
      i++;
    }

    // expect to have iterated over every key-value put ("e", "5")
    expect(i).to.equal(prefixVals.length - 1);
  });

  it("performs batch ops", async () => {
    const kvs: KV[] = [
      ["a", "1"],
      ["b", "2"],
      ["c", "3"],
      ["d", "4"],
      ["e", "5"],
    ];

    await kv.putMany(kvs);

    for (const [key, value] of kvs) {
      const val = await kv.getString(key);
      expect(val).to.eql(value);
    }

    const gotKvs = await kv.getMany(kvs.map(([k, _]) => k));
    for (const [[k, v], [key, value]] of zip(kvs, gotKvs)) {
      expect(k).to.eql(key);
      expect(v).to.eql(value);
    }

    await kv.removeMany(kvs.map(([k, _]) => k));

    for (const [key, _] of kvs) {
      const val = await kv.getString(key);
      expect(val).to.be.undefined;
    }
  });

  it("does not return undefined when getMany is called with DNE keys", async () => {
    const kvs: KV[] = [
      ["a", "1"],
      ["b", "2"],
      ["c", "3"],
    ];

    await kv.putMany(kvs);

    for (const [key, value] of kvs) {
      const val = await kv.getString(key);
      expect(val).to.eql(value);
    }

    const keysWithDNE = ["a", "b", "c", "d", "e"];

    const gotKvs = await kv.getMany(keysWithDNE);
    expect(gotKvs.length).to.eql(3);

    for (const [key, value] of gotKvs) {
      expect(["a", "b", "c"].includes(key)).to.be.true;
      expect(["1", "2", "3"].includes(value)).to.be.true;
    }
  });
});
