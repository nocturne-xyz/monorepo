import { BinaryPoseidonTree, Note, fetchInsertions } from "@flax/sdk";
import { bigintToBuf } from "bigint-conversion";
import { ethers } from 'ethers';
import { timer, Observable, map } from 'rxjs';
import { open, RootDatabase, Database } from 'lmdb';
import { TypedEvent } from "@flax/contracts/dist/src/common";
import { OffchainMerkleTree__factory, OffchainMerkleTree, Wallet__factory, Wallet } from "@flax/contracts";

const FIFTEEN_SECONDS = 15 * 1000;

export interface ServerParams {
	treeContractAddress: string;
	walletContractAddress: string;
	provider: ethers.providers.Provider,
	timerInterval?: number;
	dbPath?: string;
}

export interface ServerState {
	provider: ethers.providers.Provider;
	treeContract: OffchainMerkleTree;
	walletContract: Wallet;
	tree: BinaryPoseidonTree;
	db: RootDatabase,
	timerInterval: number;
	queue: bigint[];
	batch: BatchEntry[];
}

interface BatchEntry {
	accumulatorBytes: number[],
	isNoteCommitment: boolean,
}

export async function init({ treeContractAddress, walletContractAddress, provider, timerInterval, dbPath }: ServerParams): Promise<ServerState> {
	const treeContract = OffchainMerkleTree__factory.connect(treeContractAddress, provider);
	const walletContract = Wallet__factory.connect(walletContractAddress, provider);
	const tree = new BinaryPoseidonTree();
	const db = open({ path: dbPath ?? "./db" });
	timerInterval = timerInterval ?? FIFTEEN_SECONDS;

	return {
		provider,
		treeContract,
		walletContract,
		tree,
		db,
		timerInterval,
		queue: [],
		batch: [],
	}
}

type EventArgs<T> = T extends TypedEvent<infer A> ? A : never;

const NEXT_BLOCK_TO_INDEX_KEY = "NEXT_BLOCK_TO_INDEX";
const INSERTION_PREFIX = "TREE_INSERTION";

async function getInsertionsObservable(treeContract: OffchainMerkleTree, timerInterval: number, db: Database<string, string>): Promise<Observable<Note | bigint>> {
	interface OrderedEvent<T> {
		inner: T,
		blockNumber: number;
		transactionIndex: number;
		logIndex: number;
	}

	const nextBlockToIndexStr = await db.get(NEXT_BLOCK_TO_INDEX_KEY) ?? "0";
	let nextBlockToIndex = parseInt(nextBlockToIndexStr);
	return new Observable(subscriber => {
		let index = 0;
		const timerSubscription = timer(timerInterval)
			.subscribe({
				next: async (_) => {
					const currentBlockNumber = await treeContract.provider.getBlockNumber();
					if (nextBlockToIndex > currentBlockNumber) {
						return;
					}

					const insertions = await fetchInsertions(treeContract, nextBlockToIndex, currentBlockNumber);

					await db.transaction(
						() => {
							let keyIndex = index;
							for (const insertion of insertions) {
								db.put(`${INSERTION_PREFIX}-${keyIndex.toString()}`, JSON.stringify(insertion));
								keyIndex += 1;
							}
						}
					);

					for (const insertion of insertions) {
						subscriber.next(insertion);
						index += 1;
					}
					
					await db.put(NEXT_BLOCK_TO_INDEX_KEY, (currentBlockNumber + 1).toString());
					nextBlockToIndex = currentBlockNumber + 1;
				},
				error: err => {
					console.error("error when fetching insertions:", err);
					subscriber.complete();
				},
			});
		
		return function unsubscribe() {
			timerSubscription.unsubscribe();
		}
	});
}

export async function start(state: ServerState): Promise<void> {
	const { provider, treeContract, walletContract, tree, db, timerInterval, queue, batch } = state;

	const insertionDB = db.openDB<string, string>({ name: "insertions" });
	const insertions = await getInsertionsObservable(treeContract, timerInterval, insertionDB);

	interface TaggedLeafInsertion {
		isNoteCommitment: boolean;
		nc: bigint;
		accumulatorBytes: number[];
	}

	const leafAccumulators: Observable<TaggedLeafInsertion> = insertions.pipe(
		map(noteOrCommitment => {
			if (typeof noteOrCommitment === "bigint") {
				const nc = noteOrCommitment;
				const accumulatorBytes = [...new Uint8Array(bigintToBuf(noteOrCommitment, true))];
				return {
					isNoteCommitment: true,
					nc,
					accumulatorBytes	
				}
			} else {
				const note = noteOrCommitment;
				return {
					isNoteCommitment: false,
					nc: note.toCommitment(),
					accumulatorBytes: note.sha256()
				}
			}
		})
	)

	leafAccumulators.subscribe({
		next: ({ nc, accumulatorBytes, isNoteCommitment }) => {
			tree.insert(nc);
			batch.push({ isNoteCommitment, accumulatorBytes});

			if (batch.length === BinaryPoseidonTree.BATCH_SIZE)	{
				const accumulatorHash = accumulate(queue, batch);
			}
		}
	})
}