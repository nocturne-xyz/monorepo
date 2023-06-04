import { getDefaultProvider, utils } from "ethers";
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
  WithTimestamp,
  IncludedNoteWithNullifier,
} from "../src";
import { Handler, Handler__factory } from "@nocturne-xyz/contracts";

export const DUMMY_CONTRACT_ADDR = "0x67f8f9a5d4290325506b119980660624dc7d3ba9";

export const shitcoin: Asset = {
  assetType: AssetType.ERC20,
  assetAddr: "0xddbd1e80090943632ed47b1632cb36e7ca28abc2",
  id: 0n,
};
export const encodedShitcoin = AssetTrait.encode(shitcoin);

export const ponzi: Asset = {
  assetType: AssetType.ERC20,
  assetAddr: "0x6798639591530fbbafd12c2826422b58bd2c5219",
  id: 0n,
};
export const encodedPonzi = AssetTrait.encode(ponzi);

export const stablescam: Asset = {
  assetType: AssetType.ERC20,
  assetAddr: "0x6375394335f34848b850114b66a49d6f47f2cda8",
  id: 0n,
};
export const encodedStablescam = AssetTrait.encode(stablescam);

export const monkey: Asset = {
  assetType: AssetType.ERC721,
  assetAddr: "0x42fad9d9197846ef2bfb1418e953ca449798e022",
  id: 1n,
};

export const plutocracy: Asset = {
  assetType: AssetType.ERC1155,
  assetAddr: "0x0e1136cc3a2147ca178d265ae336602217988f48",
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
  lastCommittedMerkleIndex?: number;
  timestamps?: number[];
}

export async function setup(
  noteAmounts: bigint[],
  assets: Asset[],
  opts?: TestSetupOpts
): Promise<[NocturneDB, SparseMerkleProver, NocturneSigner, Handler]> {
  const signer = new NocturneSigner(1n);

  const kv = new InMemoryKVStore();
  const nocturneDB = new NocturneDB(kv);
  const merkleProver = new SparseMerkleProver(kv);

  const notes = zip(noteAmounts, assets).map(([amount, asset], i) => ({
    owner: signer.generateRandomStealthAddress(),
    nonce: BigInt(i),
    asset: asset,
    value: amount,
    merkleIndex: i,
  }));

  const nullifiers = notes.map((n) => signer.createNullifier(n));
  const notesWithNullfiers = zip(notes, nullifiers).map(([n, nf]) =>
    NoteTrait.toIncludedNoteWithNullifier(n, nf)
  );

  let withTimestamps: WithTimestamp<IncludedNoteWithNullifier>[];
  if (opts?.timestamps) {
    let timestamps = opts?.timestamps;
    withTimestamps = notesWithNullfiers.map((n, i) => ({
      inner: n,
      timestampUnixMillis: timestamps[i],
    }));
  } else {
    withTimestamps = notesWithNullfiers.map((n) => ({
      inner: n,
      timestampUnixMillis: 0,
    }));
  }

  await nocturneDB.storeNotes(withTimestamps);
  await nocturneDB.setLastCommittedMerkleIndex(
    opts?.lastCommittedMerkleIndex ?? notes.length - 1
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
