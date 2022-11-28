
import { BinaryPoseidonTree, subtreeUpdateInputsFromBatch } from "@flax/sdk";
import { ethers } from 'ethers';
import { scan, bufferCount, timer } from 'rxjs';
import { open, RootDatabase } from 'lmdb';
import { Wallet__factory, Wallet } from "@flax/contracts";
import { getInsertionsObservable } from "./getInsertions";
import { genAndSubmitProof } from "./genAndSubmitProof";

const FIFTEEN_SECONDS = 15 * 1000;

export interface SeverParamsInput {
	walletContractAddress: string;
	provider: ethers.providers.Provider,
	batchInterval?: number;
	pollInterval?: number;
	dbPath?: string;
}

export interface ServerParams {
	walletContract: Wallet;
	db: RootDatabase,
	batchInterval: number;
	pollInterval: number;
}

export function init({ walletContractAddress, provider, batchInterval, pollInterval, dbPath }: SeverParamsInput): ServerParams {
	const walletContract = Wallet__factory.connect(walletContractAddress, provider);
	const db = open({ path: dbPath ?? "./db" });
	batchInterval = batchInterval ?? FIFTEEN_SECONDS;
	pollInterval = pollInterval ?? FIFTEEN_SECONDS;

	return {
		walletContract,
		db,
		batchInterval,
		pollInterval,
	}
}

export async function start(state: ServerParams): Promise<void> {
	const { walletContract,  db, batchInterval, pollInterval } = state;

	const insertionDB = db.openDB<string, string>({ name: "insertions" });
	const insertions = await getInsertionsObservable(walletContract, pollInterval, insertionDB);

	const timerSubscription = timer(batchInterval)
		.subscribe(_ => walletContract.fillBatchWithZeros());

	const proofInputs = insertions.pipe(
		bufferCount(BinaryPoseidonTree.BATCH_SIZE),
		scan((tree, batch) => subtreeUpdateInputsFromBatch(batch, tree, true), new BinaryPoseidonTree()),
	);

	const server = new Promise((res, rej) => {
		proofInputs.subscribe({
			next: (proofInputs) => {
				genAndSubmitProof(proofInputs, walletContract)
					.catch(err => {
						console.error("error when generating and submitting proof:", err);
						rej(err);
					});
			},
			error: err => {
				rej(err);
			},
			complete: () => {
				console.log("exiting");
				timerSubscription.unsubscribe();
				res(undefined);
			}
		})
	});

	await server;
}