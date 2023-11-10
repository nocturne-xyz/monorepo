import "mocha";
import { ethers, getDefaultProvider, utils } from "ethers";
import {
  Asset,
  AssetTrait,
  AssetType,
  InMemoryKVStore,
  NoteTrait,
  zip,
  NocturneSigner,
  SparseMerkleProver,
  IncludedNoteWithNullifier,
  WithTotalEntityIndex,
  range,
  IncludedNote,
  NocturneViewer,
  PreSignOperation,
  PreSignJoinSplit,
  iterChunks,
  MerkleProofInput,
} from "@nocturne-xyz/core";
import { NocturneDB } from "../src";
import { Handler, Handler__factory } from "@nocturne-xyz/contracts";
import { loadNocturneConfigBuiltin } from "@nocturne-xyz/config";
export const DUMMY_CONFIG = loadNocturneConfigBuiltin("example-network");

export const DUMMY_ROOT_KEY = Uint8Array.from(range(32));

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

// default anvil keys
// corresponds to mnemonic `test test test test test test test test test test test junk`
// and derivation path `m/44'/60'/0'/0/`
export const DUMMY_KEYS = [
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", // anvil #0
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", // anvil #1
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", // anvil #2
  "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6", // anvil #3
  "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a", // anvil #4
  "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba", // anvil #5
  "0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e", // anvil #6
  "0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356", // anvil #7
  "0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97", // anvil #8
  "0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6", // anvil #9
];
export const DUMMY_ADDRESSES = DUMMY_KEYS.map(
  (k) => new ethers.Wallet(k).connect(ethers.getDefaultProvider()).address
);

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

  const nullifiers = notes.map((n) => NoteTrait.createNullifier(signer, n));
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

export function dummyNotesAndNfs(
  viewer: NocturneViewer,
  notesPerAsset: number,
  ...assets: Asset[]
): [IncludedNoteWithNullifier[], bigint[]] {
  const owner = viewer.generateRandomStealthAddress();
  const notes: IncludedNoteWithNullifier[] = [];
  const nullifiers: bigint[] = [];
  let offset = 0;
  for (const asset of assets) {
    const allNotes: IncludedNote[] = range(notesPerAsset).map((i) => ({
      owner,
      nonce: BigInt(i + offset),
      asset,
      value: 100n,
      merkleIndex: i + offset,
    }));
    const allNfs = allNotes.map((n) => NoteTrait.createNullifier(viewer, n));
    const notesWithNFs = zip(allNotes, allNfs).map(([n, nf]) =>
      NoteTrait.toIncludedNoteWithNullifier(n, nf)
    );

    notes.push(...notesWithNFs);
    nullifiers.push(...notes.map((n) => NoteTrait.createNullifier(viewer, n)));

    offset += notesPerAsset;
  }

  return [notes, nullifiers];
}

export type TestJoinSplit = Omit<
  PreSignJoinSplit,
  "oldNoteA" | "oldNoteB" | "newNoteA" | "newNoteB"
> & {
  oldNoteA: IncludedNoteWithNullifier;
  oldNoteB: IncludedNoteWithNullifier;
  newNoteA: IncludedNote;
  newNoteB: IncludedNote;
};
export type TestOperation = Omit<PreSignOperation, "joinSplits"> & {
  joinSplits: TestJoinSplit[];
};

export function dummyOp(
  viewer: NocturneViewer,
  numJoinSplits: number,
  asset: Asset
): TestOperation {
  const [dummyOldNotes, dummyNfs] = dummyNotesAndNfs(
    viewer,
    numJoinSplits * 2,
    asset
  );
  const [dummyNewNotes] = dummyNotesAndNfs(viewer, numJoinSplits * 2, asset);

  const encodedAsset = AssetTrait.encode(asset);
  const joinSplits: TestJoinSplit[] = zip(
    zip(
      [...iterChunks(dummyOldNotes, 2, true)],
      [...iterChunks(dummyNewNotes, 2, true)]
    ),
    [...iterChunks(dummyNfs, 2, true)]
  ).map(
    (
      [[[oldNoteA, oldNoteB], [newNoteA, newNoteB]], [nullifierA, nullifierB]],
      i,
      arr
    ) => ({
      commitmentTreeRoot: 0n,
      nullifierA,
      nullifierB,
      newNoteACommitment: NoteTrait.toCommitment(newNoteA),
      newNoteBCommitment: NoteTrait.toCommitment(newNoteB),
      senderCommitment: 0n,
      joinSplitInfoCommitment: 0n,
      encodedAsset,
      publicSpend: 0n,
      newNoteAEncrypted: {
        ciphertextBytes: [],
        encapsulatedSecretBytes: [],
      },
      newNoteBEncrypted: {
        ciphertextBytes: [],
        encapsulatedSecretBytes: [],
      },
      receiver: { x: 0n, y: 0n },
      oldNoteA: { ...oldNoteA, merkleIndex: 2 * i, nullifier: nullifierA },
      oldNoteB: { ...oldNoteB, merkleIndex: 2 * i + 1, nullifier: nullifierB },
      newNoteA: { ...newNoteA, merkleIndex: 2 * i + 2 * arr.length },
      newNoteB: { ...newNoteB, merkleIndex: 2 * i + 1 + 2 * arr.length },
      merkleProofA: dummyMerkleProof(2 * i),
      merkleProofB: dummyMerkleProof(2 * i + 1),
      refundAddr: {
        h1: 0n,
        h2: 0n,
      },
    })
  );

  return {
    networkInfo: {
      chainId: 0n,
      tellerContract: DUMMY_ADDRESSES[0],
    },
    refundAddr: {
      h1: 0n,
      h2: 0n,
    },
    refunds: [],
    actions: [],
    encodedGasAsset: encodedAsset,
    gasAssetRefundThreshold: 0n,
    executionGasLimit: 0n,
    gasPrice: 0n,
    deadline: 0n,
    atomicActions: false,
    joinSplits,
    gasFeeEstimate: 0n,
  };
}

export type OpNotesAndNfs = {
  oldNotes: IncludedNoteWithNullifier[];
  newNotes: IncludedNote[];
  nfs: bigint[];
};

export function getNotesAndNfsFromOp(op: TestOperation): OpNotesAndNfs {
  return {
    oldNotes: op.joinSplits.flatMap((op) => [op.oldNoteA, op.oldNoteB]),
    newNotes: op.joinSplits.flatMap((op) => [op.newNoteA, op.newNoteB]),
    nfs: op.joinSplits.flatMap((op) => [op.nullifierA, op.nullifierB]),
  };
}

export function dummyMerkleProof(index: number): MerkleProofInput {
  return {
    path: range(16).map((i) => BigInt((index >> (2 * i)) & 3)),
    siblings: range(16).map((i) => [0n, 0n, 0n, 0n]),
  };
}
