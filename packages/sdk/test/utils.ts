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
} from "../src";
import { Handler, Handler__factory } from "@nocturne-xyz/contracts";

export const shitcoin: Asset = {
  assetType: AssetType.ERC20,
  assetAddr: "0x123",
  id: 0n,
};
export const encodedShitcoin = AssetTrait.encode(shitcoin);

export const ponzi: Asset = {
  assetType: AssetType.ERC20,
  assetAddr: "0x456",
  id: 0n,
};
export const encodedPonzi = AssetTrait.encode(ponzi);

export const stablescam: Asset = {
  assetType: AssetType.ERC20,
  assetAddr: "0x789",
  id: 0n,
};
export const encodedStablescam = AssetTrait.encode(stablescam);

export const monkey: Asset = {
  assetType: AssetType.ERC721,
  assetAddr: "0xabc",
  id: 1n,
};

export const plutocracy: Asset = {
  assetType: AssetType.ERC1155,
  assetAddr: "0xdef",
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
  mockMerkle: boolean;
}

export async function setup(
  noteAmounts: bigint[],
  assets: Asset[]
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
  await nocturneDB.storeNotes(notesWithNullfiers);

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
