import { NocturneDB } from "./NocturneDB";
import { PreSignOperation, SignedOperation } from "./primitives";
import { maxArray, getMerkleIndicesAndNfsFromOp } from "./utils";

export async function getCreationTimestampOfNewestNoteInOp(
  db: NocturneDB,
  op: PreSignOperation | SignedOperation
): Promise<number> {
  // get the max merkle index of any note in any joinsplit in the op
  const maxMerkleIndex = maxArray(
    getMerkleIndicesAndNfsFromOp(op).map(({ merkleIndex }) => merkleIndex)
  );

  // get the corresponding timestamp
  const timestamp = await db.getTimestampForMerkleIndex(Number(maxMerkleIndex));

  if (timestamp === undefined) {
    throw new Error(
      `timestamp not found for newest note with merkle index ${maxMerkleIndex}`
    );
  }

  return timestamp;
}
