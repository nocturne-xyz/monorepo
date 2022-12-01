
import { BinaryPoseidonTree, packToSolidityProof, SubtreeUpdateInputSignals, SubtreeUpdateProver, toJSON } from "@nocturne-xyz/sdk";
import { RootDatabase } from 'lmdb';
import { Wallet } from "@nocturne-xyz/contracts";
import { subtreeUpdateInputsFromBatch, applyBatchUpdateToTree } from "@nocturne-xyz/local-prover";
import { Note } from "@nocturne-xyz/sdk";
import { fetchInsertions } from "@nocturne-xyz/sdk";

export interface UpdaterParams {
  walletContract: Wallet;
  rootDB: RootDatabase,
}

export interface SubtreeUpdater {
  poll: () => Promise<void>;
  fillbatch: () => Promise<void>;
  dropDb: () => Promise<void>;
}

const NEXT_BLOCK_TO_INDEX_KEY = "NEXT_BLOCK_TO_INDEX";
const NEXT_INSERTION_INDEX_KEY = "NEXT_INSERTION_INDEX";
const INSERTION_PREFIX = "TREE_INSERTION";

function insertionKey(idx: number) {
  return `${INSERTION_PREFIX}-${idx}`;
}

export async function subtreeUpdater(params: UpdaterParams, prover: SubtreeUpdateProver): Promise<SubtreeUpdater> {
  const { walletContract, rootDB } = params;

  const insertions: (Note | bigint)[] = [];
  const tree = new BinaryPoseidonTree();
  const db = rootDB.openDB<string, string>({ name: "insertions" });
  
  const nextBlockToIndexStr = await db.get(NEXT_BLOCK_TO_INDEX_KEY) ?? "0";
  let nextBlockToIndex = parseInt(nextBlockToIndexStr);

  const indexStr = await db.get(NEXT_INSERTION_INDEX_KEY) ?? "0";
  let index = parseInt(indexStr);

  const tryGenAndSubmitProof = async () => {
    while (insertions.length >= BinaryPoseidonTree.BATCH_SIZE) {
      const batch = insertions.slice(0, BinaryPoseidonTree.BATCH_SIZE);
      const merkleProof = applyBatchUpdateToTree(batch, tree);
      const inputs = subtreeUpdateInputsFromBatch(batch, merkleProof);
      const newRoot = tree.root() as bigint;
      await genAndSubmitProof(walletContract, inputs, prover, newRoot);
      insertions.splice(0, BinaryPoseidonTree.BATCH_SIZE);
    }
  };

  return {
    async poll() {
      const currentBlockNumber = await walletContract.provider.getBlockNumber();
      if (nextBlockToIndex > currentBlockNumber) {
        return;
      }

      const newInsertions = await fetchInsertions(walletContract, nextBlockToIndex, currentBlockNumber);
      insertions.push(...newInsertions);
      
      await db.transaction(
        () => {
          let keyIndex = index;
          for (const insertion of newInsertions) {
            db.put(insertionKey(keyIndex), toJSON(insertion));
            keyIndex += 1;
          }
        }
      );

      await db.put(NEXT_INSERTION_INDEX_KEY, (index + newInsertions.length).toString());
      await db.put(NEXT_BLOCK_TO_INDEX_KEY, (currentBlockNumber + 1).toString());
      nextBlockToIndex = currentBlockNumber + 1;
      index += newInsertions.length;
      
      await tryGenAndSubmitProof();
    },

    async fillbatch() {
      await walletContract.fillBatchWithZeros();
    },

    async dropDb() {
      await db.drop();
    },
  };
}

async function genAndSubmitProof(contract: Wallet, inputs: SubtreeUpdateInputSignals, prover: SubtreeUpdateProver, newRoot: bigint): Promise<void> {
  const { proof } = await prover.prove(inputs);
  const solidityProof = packToSolidityProof(proof);

  await contract.applySubtreeUpdate(newRoot, solidityProof);
}
