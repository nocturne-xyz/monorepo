import { NocturneDB } from "./NocturneDB";
import { PreSignOperation, SignedOperation } from "./primitives";
import { TotalEntityIndex } from "./sync";
import { maxArray, getMerkleIndicesAndNfsFromOp } from "./utils";

export async function getTotalEntityIndexOfNewestNoteInOp(
  db: NocturneDB,
  op: PreSignOperation | SignedOperation
): Promise<TotalEntityIndex> {
  // get the max merkle index of any note in any joinsplit in the op
  const maxMerkleIndex = maxArray(
    getMerkleIndicesAndNfsFromOp(op).map(({ merkleIndex }) => merkleIndex)
  );

  // get the corresponding TotalEntityIndex
  const totalEntityIndex = await db.getTotalEntityIndexForMerkleIndex(
    Number(maxMerkleIndex)
  );

  if (totalEntityIndex === undefined) {
    throw new Error(
      `totalEntityIndex not found for newest note with merkle index ${maxMerkleIndex}`
    );
  }

  return totalEntityIndex;
}
