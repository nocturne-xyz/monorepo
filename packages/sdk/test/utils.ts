import { getDefaultProvider, utils } from "ethers";
import {
  Asset,
  AssetTrait,
  AssetType,
  InMemoryKVStore,
  MerkleProver,
  MockMerkleProver,
  NoteTrait,
  NotesDB,
  zip,
} from "../src/sdk";
import { NocturneSigner } from "../src/crypto";
import { Wallet, Wallet__factory } from "@nocturne-xyz/contracts";
import { InMemoryMerkleProver, MerkleDB } from "../dist";

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

export interface TestSetupOpts {
  mockMerkle: boolean;
}

export const defaultTestSetupOpts: TestSetupOpts = {
  mockMerkle: true,
};

export async function setup(
  noteAmounts: bigint[],
  assets: Asset[],
  opts: TestSetupOpts = defaultTestSetupOpts
): Promise<[NotesDB, MerkleProver, NocturneSigner, Wallet]> {
  const { mockMerkle } = opts;

  const signer = new NocturneSigner(1n);

  const kv = new InMemoryKVStore();
  const notesDB = new NotesDB(kv);

  const notes = zip(noteAmounts, assets).map(([amount, asset], i) => ({
    owner: signer.getRandomStealthAddress(),
    nonce: BigInt(i),
    asset: asset,
    value: amount,
    merkleIndex: i,
  }));
  await notesDB.storeNotes(notes);

  const dummyWalletAddr = "0xcd3b766ccdd6ae721141f452c550ca635964ce71";
  const provider = getDefaultProvider();
  const wallet = Wallet__factory.connect(dummyWalletAddr, provider);

  let merkleProver: MerkleProver;
  if (mockMerkle) {
    merkleProver = new MockMerkleProver();
  } else {
    const db = new MerkleDB(kv);
    await Promise.all(
      notes.map(NoteTrait.toCommitment).map((leaf, i) => db.storeLeaf(i, leaf))
    );
    merkleProver = await InMemoryMerkleProver.fromDb(
      dummyWalletAddr,
      provider,
      db
    );
  }

  return [notesDB, merkleProver, signer, wallet];
}
