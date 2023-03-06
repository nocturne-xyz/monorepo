import {
  AssetTrait,
  BinaryPoseidonTree,
  IncludedEncryptedNote,
  Nullifier,
} from "../../primitives";
import { min } from "../../utils";
import { ClosableAsyncIterator } from "../closableAsyncIterator";
import {
  EncryptedStateDiff,
  IterStateDiffsOpts,
  SyncAdapter,
} from "../syncAdapter";
import { Wallet } from "@nocturne-xyz/contracts";
import { maxArray } from "../../utils";
import { JoinSplitEvent } from "../../notesManager";
import {
  fetchJoinSplits,
  fetchNotesFromRefunds,
  fetchSubtreeUpdateCommits,
} from "./fetch";

// TODO: mess with this a bit
const RPC_MAX_CHUNK_SIZE = 1000;

export class RPCSyncAdapter implements SyncAdapter {
  private walletContract: Wallet;

  constructor(walletContract: Wallet) {
    this.walletContract = walletContract;
  }

  async iterStateDiffs(
    startBlock: number,
    opts?: IterStateDiffsOpts
  ): Promise<ClosableAsyncIterator<EncryptedStateDiff>> {
    const chunkSize = opts?.maxChunkSize
      ? min(opts.maxChunkSize, RPC_MAX_CHUNK_SIZE)
      : RPC_MAX_CHUNK_SIZE;
    const endBlock = opts?.endBlock;
    let closed = false;

    const walletContract = this.walletContract;
    const generator = async function* () {
      let nextMerkleIndex = (await walletContract.count()).toNumber();
      let from = startBlock;
      while (!closed && (!endBlock || from < endBlock)) {
        let to = from + chunkSize;
        if (endBlock) {
          to = min(to, endBlock);
        }

        // fetch event data from chain
        const [
          includedNotes,
          joinSplitEvents,
          blockNumber,
          subtreeUpdateCommits,
        ] = await Promise.all([
          await fetchNotesFromRefunds(walletContract, from, to),
          await fetchJoinSplits(walletContract, from, to),
          await walletContract.provider.getBlockNumber(),
          await fetchSubtreeUpdateCommits(walletContract, from, to),
        ]);

        // extract notes and nullifiers
        const nullifiers =
          extractNullifiersFromJoinSplitEvents(joinSplitEvents);
        const encryptedNotes =
          extractEncryptedNotesFromJoinSplitEvents(joinSplitEvents);
        const notes = [...includedNotes, ...encryptedNotes];

        notes.sort((a, b) => a.merkleIndex - b.merkleIndex);

        // get the latest subtree commit
        if (subtreeUpdateCommits.length > 0) {
          nextMerkleIndex = maxArray(
            subtreeUpdateCommits.map(
              (c) => (c.subtreeIndex + 1) * BinaryPoseidonTree.BATCH_SIZE
            )
          );
        }

        const diff: EncryptedStateDiff = {
          notes,
          nullifiers,
          nextMerkleIndex,
          blockNumber,
        };
        yield diff;

        from = to;
      }
    };

    return new ClosableAsyncIterator(generator(), async () => {
      closed = true;
    });
  }
}

function extractNullifiersFromJoinSplitEvents(
  joinSplitEvents: JoinSplitEvent[]
): Nullifier[] {
  const nullifiers: Nullifier[] = [];
  for (const e of joinSplitEvents) {
    const { oldNoteANullifier, oldNoteBNullifier } = e;
    nullifiers.push(oldNoteANullifier, oldNoteBNullifier);
  }
  return nullifiers;
}

function extractEncryptedNotesFromJoinSplitEvents(
  joinSplitEvents: JoinSplitEvent[]
): IncludedEncryptedNote[] {
  const encryptedNotes: IncludedEncryptedNote[] = [];
  for (const e of joinSplitEvents) {
    const { newNoteAIndex, newNoteBIndex } = e;
    const {
      newNoteAEncrypted,
      newNoteBEncrypted,
      newNoteACommitment,
      newNoteBCommitment,
      encodedAsset,
    } = e.joinSplit;

    const asset = AssetTrait.decode(encodedAsset);

    encryptedNotes.push({
      ...newNoteAEncrypted,
      asset,
      commitment: newNoteACommitment,
      merkleIndex: newNoteAIndex,
    });

    encryptedNotes.push({
      ...newNoteBEncrypted,
      asset,
      commitment: newNoteBCommitment,
      merkleIndex: newNoteBIndex,
    });
  }
  return encryptedNotes;
}
