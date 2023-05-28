import { JoinSplitRequest } from "../operationRequest";
import {
  Note,
  PreProofJoinSplit,
  PreSignJoinSplit,
  PreSignOperation,
  SignedOperation,
} from "../primitives";

export function sortNotesByValue<T extends Note>(notes: T[]): T[] {
  return notes.sort((a, b) => {
    return Number(a.value - b.value);
  });
}

export function getJoinSplitRequestTotalValue(
  joinSplitRequest: JoinSplitRequest
): bigint {
  let totalVal = joinSplitRequest.unwrapValue;
  if (joinSplitRequest.payment !== undefined) {
    totalVal += joinSplitRequest.payment.value;
  }
  return totalVal;
}

export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function merklePathToIndex(
  pathIndices: bigint[],
  direction: "ROOT_TO_LEAF" | "LEAF_TO_ROOT"
): bigint {
  if (direction === "LEAF_TO_ROOT") {
    pathIndices = [...pathIndices].reverse();
  }

  return pathIndices.reduce(
    (idx, pathIndex) => (idx << 2n) | BigInt(pathIndex),
    0n
  );
}

export interface NullifierWithMerkleIndex {
  nullifier: bigint;
  merkleIndex: bigint;
}

// returns the merkle indices of the notes spent in an op
export function getMerkleIndicesAndNfsFromOp(
  op: PreSignOperation | SignedOperation
): NullifierWithMerkleIndex[] {
  return op.joinSplits.flatMap((joinSplit) => {
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
      {
        merkleIndex: merklePathToIndex(merklePathA, "LEAF_TO_ROOT"),
        nullifier: joinSplit.nullifierA,
      },
      {
        merkleIndex: merklePathToIndex(merklePathB, "LEAF_TO_ROOT"),
        nullifier: joinSplit.nullifierB,
      },
    ];
  });
}

export async function bundlerHasNullifier(
  bundlerEndpoint: string,
  nullifier: bigint
): Promise<boolean> {
  const res = await fetch(
    `${bundlerEndpoint}/nullifier/${nullifier.toString()}`,
    {
      method: "GET",
    }
  );

  let exists;
  try {
    const resJson = await res.json();
    exists = resJson.exists;
  } catch (err) {
    throw new Error(`failed to parse bundler response: ${err}`);
  }

  return exists;
}
