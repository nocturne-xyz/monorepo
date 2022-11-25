import { OffchainMerkleTree } from "@flax/contracts";
import { BinaryPoseidonTree } from "@flax/sdk";

export async function fillBatch(merkle: OffchainMerkleTree) {
	const batchLen = await merkle.batchLen();
	const amountToInsert = BinaryPoseidonTree.BATCH_SIZE - batchLen.toNumber();
	for (let i = 0; i < amountToInsert; i++) {
		await merkle.insertNoteCommitment(0n);
	}
}
