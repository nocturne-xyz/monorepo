import "mocha";
import { expect } from "chai";
import { ethers, getDefaultProvider, utils } from "ethers";
import {
  Asset,
  AssetTrait,
  AssetType,
  InMemoryKVStore,
  NoteTrait,
  NocturneDB,
  zip,
  NocturneSigner,
  SparseMerkleProver,
  IncludedNoteWithNullifier,
  WithTotalEntityIndex,
  range,
  IncludedNote,
  KV,
  KVStore,
  DumpableKVStore,
} from "../src";
import { Handler, Handler__factory } from "@nocturne-xyz/contracts";
import randomBytes from "randombytes";
import { loadNocturneConfigBuiltin } from "@nocturne-xyz/config";

export const DUMMY_ROOT_KEY = Uint8Array.from(range(32));

export function randomBigInt(): bigint {
  const rand = randomBytes(32);
  return BigInt("0x" + rand.toString("hex"));
}

export const DUMMY_CONFIG = loadNocturneConfigBuiltin("example-network");

export const DUMMY_CONTRACT_ADDR = ethers.utils.getAddress(
  "0x67f8f9a5d4290325506b119980660624dc7d3ba9"
);

export const shitcoin: Asset = {
  assetType: AssetType.ERC20,
  assetAddr: ethers.utils.getAddress(
    "0xddbd1e80090943632ed47b1632cb36e7ca28abc2"
  ),
  id: 0n,
};
export const encodedShitcoin = AssetTrait.encode(shitcoin);

export const ponzi: Asset = {
  assetType: AssetType.ERC20,
  assetAddr: ethers.utils.getAddress(
    "0x6798639591530fbbafd12c2826422b58bd2c5219"
  ),
  id: 0n,
};
export const encodedPonzi = AssetTrait.encode(ponzi);

export const stablescam: Asset = {
  assetType: AssetType.ERC20,
  assetAddr: ethers.utils.getAddress(
    "0x6375394335f34848b850114b66a49d6f47f2cda8"
  ),
  id: 0n,
};
export const encodedStablescam = AssetTrait.encode(stablescam);

export const monkey: Asset = {
  assetType: AssetType.ERC721,
  assetAddr: ethers.utils.getAddress(
    "0x42fad9d9197846ef2bfb1418e953ca449798e022"
  ),
  id: 1n,
};

export const plutocracy: Asset = {
  assetType: AssetType.ERC1155,
  assetAddr: ethers.utils.getAddress(
    "0x0e1136cc3a2147ca178d265ae336602217988f48"
  ),
  id: 1n,
};
export const encodedPlutocracy = AssetTrait.encode(plutocracy);

export const testGasAssets = new Map(
  [shitcoin, ponzi, stablescam, monkey, plutocracy].map((asset) => [
    asset.assetAddr,
    AssetTrait.erc20AddressToAsset(asset.assetAddr),
  ])
);

export function getDummyHex(bump: number): string {
  const hex = utils.keccak256("0x" + bump.toString(16).padStart(64, "0"));
  return hex;
}

export interface TestSetupOpts {
  latestCommittedMerkleIndex?: number;
  totalEntityIndices?: bigint[];
}

export async function setup(
  noteAmounts: bigint[],
  assets: Asset[],
  opts?: TestSetupOpts
): Promise<[NocturneDB, SparseMerkleProver, NocturneSigner, Handler]> {
  const signer = new NocturneSigner(Uint8Array.from(DUMMY_ROOT_KEY));

  const kv = new InMemoryKVStore();
  const nocturneDB = new NocturneDB(kv);
  const merkleProver = new SparseMerkleProver(kv);

  const notes: IncludedNote[] = zip(noteAmounts, assets).map(
    ([amount, asset], i) => ({
      owner: signer.generateRandomStealthAddress(),
      nonce: BigInt(i),
      asset: asset,
      value: amount,
      merkleIndex: i,
    })
  );

  const nullifiers = notes.map((n) => signer.createNullifier(n));
  const notesWithNullfiers = zip(notes, nullifiers).map(([n, nf]) =>
    NoteTrait.toIncludedNoteWithNullifier(n, nf)
  );

  let withTotalEntityIndices: WithTotalEntityIndex<IncludedNoteWithNullifier>[];
  if (opts?.totalEntityIndices) {
    let totalEntityIndices = opts?.totalEntityIndices;
    withTotalEntityIndices = notesWithNullfiers.map((n, i) => ({
      inner: n,
      totalEntityIndex: totalEntityIndices[i],
    }));
  } else {
    withTotalEntityIndices = notesWithNullfiers.map((n) => ({
      inner: n,
      totalEntityIndex: 0n,
    }));
  }

  await nocturneDB.storeNotes(withTotalEntityIndices);
  await nocturneDB.setlatestCommittedMerkleIndex(
    opts?.latestCommittedMerkleIndex ?? notes.length - 1
  );

  const leaves = notes.map((note) => NoteTrait.toCommitment(note));
  merkleProver.insertBatch(
    0,
    leaves,
    leaves.map(() => true)
  );

  const dummyHandlerAddr = "0xcd3b766ccdd6ae721141f452c550ca635964ce71";
  const provider = getDefaultProvider();
  const handler = Handler__factory.connect(dummyHandlerAddr, provider);

  return [nocturneDB, merkleProver, signer, handler];
}

export const testKvStoreImpl =
  <T extends KVStore>(kv: T, cleanup?: (kv: T) => Promise<void>) =>
  async () => {
    afterEach(async () => {
      await kv.clear();
    });

    if (cleanup) {
      after(async () => await cleanup(kv));
    }

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
  };

export const testDumpableKvStoreImpl =
  <T extends DumpableKVStore>(kv: T, cleanup?: (kv: T) => Promise<void>) =>
  async () => {
    testKvStoreImpl(kv, cleanup)();

    it("dumps to an object", async () => {
      const kvs: KV[] = [
        ["a", "1"],
        ["b", "2"],
        ["c", "3"],
        ["d", "4"],
        ["e", "5"],
      ];

      await kv.putMany(kvs);

      const dump = await kv.dump();
      for (const [key, value] of kvs) {
        expect(dump[key]).to.not.be.undefined;
        expect(dump[key]).to.eql(value);
      }
    });

    it("loads from a dump", async () => {
      const kvs: KV[] = [
        ["a", "1"],
        ["b", "2"],
        ["c", "3"],
        ["d", "4"],
        ["e", "5"],
      ];

      await kv.putMany(kvs);

      const dump = await kv.dump();

      const newKV = new InMemoryKVStore();
      await newKV.loadFromDump(dump);

      for await (const [key, value] of await newKV.iterRange("a", "f")) {
        expect(dump[key]).to.not.be.undefined;
        expect(value).to.eql(dump[key]);
      }
    });
  };
