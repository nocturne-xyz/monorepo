import { timer, Observable } from 'rxjs';
import { fetchInsertions, Note } from "@flax/sdk";
import { Wallet } from "@flax/contracts";
import { Database } from 'lmdb';

const NEXT_BLOCK_TO_INDEX_KEY = "NEXT_BLOCK_TO_INDEX";
const INSERTION_PREFIX = "TREE_INSERTION";

export async function getInsertionsObservable(walletContract: Wallet, timerInterval: number, db: Database<string, string>): Promise<Observable<Note | bigint>> {

	const nextBlockToIndexStr = await db.get(NEXT_BLOCK_TO_INDEX_KEY) ?? "0";
	let nextBlockToIndex = parseInt(nextBlockToIndexStr);
	return new Observable(subscriber => {
		let index = 0;
		const timerSubscription = timer(timerInterval)
			.subscribe({
				next: async (_) => {
					const currentBlockNumber = await walletContract.provider.getBlockNumber();
					if (nextBlockToIndex > currentBlockNumber) {
						return;
					}

					const insertions = await fetchInsertions(walletContract, nextBlockToIndex, currentBlockNumber);

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
					subscriber.error(err);
				},
			});
		
		return function unsubscribe() {
			timerSubscription.unsubscribe();
		}
	});
}