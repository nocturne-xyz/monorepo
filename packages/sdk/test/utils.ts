import { getDefaultProvider, utils } from "ethers";
import { Asset, AssetTrait, AssetType, InMemoryKVStore, MerkleProver, MockMerkleProver, NocturneSigner, NotesDB, zip } from "../src/sdk";
import { NocturnePrivKey } from "../src/crypto";
import { Wallet, Wallet__factory } from "@nocturne-xyz/contracts";


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

export function getDummyHex(bump: number): string {
  const hex = utils.keccak256("0x" + bump.toString(16).padStart(64, "0"));
  return hex;
}

export async function setup(
  noteAmounts: bigint[],
  assets: Asset[]
): Promise<[NotesDB, MerkleProver, NocturneSigner, Wallet]> {
  const priv = new NocturnePrivKey(1n);
  const signer = new NocturneSigner(priv);

  const kv = new InMemoryKVStore();
  const notesDB = new NotesDB(kv);
  const merkleProver = new MockMerkleProver();

  const notes = zip(noteAmounts, assets).map(([amount, asset], i) => ({
    owner: signer.address,
    nonce: BigInt(i),
    asset: asset,
    value: amount,
    merkleIndex: i,
  }));
  await notesDB.storeNotes(notes);

  const provider = getDefaultProvider();
  const wallet = Wallet__factory.connect(
    "0xcd3b766ccdd6ae721141f452c550ca635964ce71",
    provider
  );

  return [notesDB, merkleProver, signer, wallet];
}
