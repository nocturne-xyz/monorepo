import { NocturneDB } from "./NocturneDB";
import {
  PreProofJoinSplit,
  PreSignJoinSplit,
  PreSignOperation,
  SignedOperation,
} from "./primitives";
import { maxArray, merklePathToIndex } from "./utils";

export async function getCreationTimestampOfNewestNoteInOp(
  db: NocturneDB,
  op: PreSignOperation | SignedOperation
): Promise<number> {
  // get the max merkle index of any note in any joinsplit in the op
  const maxMerkleIndex = maxArray(
    op.joinSplits.flatMap((joinSplit) => {
      // get merkle index out of the path in the merkle proof
      // how we do this depends on which kind of joinSplit it is (which depends on the op)
      let merklePathA: bigint[];
      let merklePathB: bigint[];

      if (Object.hasOwn(joinSplit, "proofInputs")) {
        // if it has "proofInputs", it's a `PreProofJoinSplit`
        // in this case, we get the merkle path out of the proofInputs
        merklePathA = (joinSplit as PreProofJoinSplit).proofInputs.merkleProofA
          .path;
        merklePathB = (joinSplit as PreProofJoinSplit).proofInputs.merkleProofB
          .path;
      } else {
        // otherwise, it's a `PreSignJoinSplit`, in which case we get it out of the joinsplit itself
        merklePathA = (joinSplit as PreSignJoinSplit).merkleProofA.path;
        merklePathB = (joinSplit as PreSignJoinSplit).merkleProofB.path;
      }

      return [
        merklePathToIndex(merklePathA, "LEAF_TO_ROOT"),
        merklePathToIndex(merklePathB, "LEAF_TO_ROOT"),
      ];
    })
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
