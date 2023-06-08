import {
  Address,
  AssetTrait,
  IncludedEncryptedNote,
  Nullifier,
  WithTimestamp,
} from "../../primitives";
import { min } from "../../utils";
import {
  EncryptedStateDiff,
  IterSyncOpts,
  SDKSyncAdapter,
} from "../syncAdapter";
import { Handler, Handler__factory } from "@nocturne-xyz/contracts";
import {
  maxArray,
  sleep,
  batchOffsetToLatestMerkleIndexInBatch,
} from "../../utils";
import {
  fetchJoinSplits,
  fetchNotesFromRefunds,
  fetchSubtreeUpdateCommits,
  getBlockContainingEventWithMerkleIndex,
  JoinSplitEvent,
} from "./fetch";
import { ethers } from "ethers";
import { Source, fromAsyncIterable } from "wonka";

// TODO: mess with this a bit
const RPC_MAX_CHUNK_SIZE = 1000;

export class RPCSDKSyncAdapter implements SDKSyncAdapter {
  private handlerContract: Handler;

  constructor(
    provider: ethers.providers.Provider,
    handlerContractAddress: Address
  ) {
    this.handlerContract = Handler__factory.connect(
      handlerContractAddress,
      provider
    );
  }

  iterStateDiffs(
    startMerkleIndex: number,
    opts?: IterSyncOpts
  ): Source<EncryptedStateDiff> {
    const chunkSize = opts?.maxChunkSize
      ? min(opts.maxChunkSize, RPC_MAX_CHUNK_SIZE)
      : RPC_MAX_CHUNK_SIZE;
    const endMerkleIndex = opts?.endMerkleIndex;
    const handlerContract = this.handlerContract;
    const generator = async function* () {
      const merkleCount = (await handlerContract.count()).toNumber();
      let lastCommittedMerkleIndex =
        merkleCount !== 0 ? merkleCount - 1 : undefined;

      // first phase - get the number of the block during which a note with merkleIndex == startMerkleIndex was created
      // if it DNE, throw an error saying that startMerkleIndex > highest merkle index of any note
      let from = 0;
      const startBlock = await getBlockContainingEventWithMerkleIndex(
        handlerContract,
        startMerkleIndex
      );
      if (startBlock) {
        from = startBlock;
      } else {
        throw new Error(
          `startMerkleIndex ${startMerkleIndex} is greater than the highest merkle index of any note`
        );
      }

      let currMerkleIndex = startMerkleIndex;
      while (!endMerkleIndex || currMerkleIndex < endMerkleIndex) {
        // set `to` to be the min of `from` + `chunkSize` and the current block number
        const currentBlock = await handlerContract.provider.getBlockNumber();
        const to = min(from + chunkSize, currentBlock);

        // if `from` > `to`, we've caught up to the tip of the chain
        // `from` can be greater than `to` if `to` was the tip of the chain last iteration,
        // and no new blocks were produced since then
        // sleep for a bit and re-try to avoid spamming the RPC endpoint
        if (from > to) {
          await sleep(5_000);
          continue;
        }

        // get all events JoinSplit, Refund, and SubtreeUpdate events in the range [`from`, `to`]
        const [includedNotes, joinSplitEvents, subtreeUpdateCommits] =
          await Promise.all([
            fetchNotesFromRefunds(handlerContract, from, to),
            fetchJoinSplits(handlerContract, from, to),
            fetchSubtreeUpdateCommits(handlerContract, from, to),
          ]);

        // extract notes and nullifiers
        const joinSplitEventsWithoutTimestamps = joinSplitEvents.map(
          ({ inner }) => inner
        );
        const nullifiers = extractNullifiersFromJoinSplitEvents(
          joinSplitEventsWithoutTimestamps
        );
        const encryptedNotes =
          extractEncryptedNotesFromJoinSplitEvents(joinSplitEvents);
        const notes = [...includedNotes, ...encryptedNotes];

        notes.sort((a, b) => a.inner.merkleIndex - b.inner.merkleIndex);

        // filter out all notes that dont fall in the range [`currMerkleIndex`, `endMerkleIndex`]
        const filteredNotes = notes.filter(
          ({ inner: { merkleIndex } }) =>
            merkleIndex >= currMerkleIndex &&
            endMerkleIndex &&
            merkleIndex <= endMerkleIndex
        );

        // if there are remaining events after filtering, get the latest merkleIndex among all new notes and set `currMerkleIndex` to that
        if (filteredNotes.length > 0) {
          currMerkleIndex =
            filteredNotes[filteredNotes.length - 1].inner.merkleIndex;
        }

        // update `lastCommittedMerkleIndex` according to the `SubtreeUpdate` events received
        if (subtreeUpdateCommits.length > 0) {
          lastCommittedMerkleIndex = maxArray(
            subtreeUpdateCommits.map(({ subtreeBatchOffset }) => {
              return batchOffsetToLatestMerkleIndexInBatch(subtreeBatchOffset);
            })
          );
        }

        // construct a state diff and yield it
        const diff: EncryptedStateDiff = {
          notes,
          nullifiers,
          lastCommittedMerkleIndex,
          merkleIndex: currMerkleIndex,
        };
        yield diff;

        // proceed to next block `from` to `to` + 1
        from = to + 1;

        // apply throttle if specified
        if (opts?.throttleMs && currentBlock - from > chunkSize) {
          await sleep(opts.throttleMs);
        }
      }
    };

    return fromAsyncIterable(generator());
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
  joinSplitEvents: WithTimestamp<JoinSplitEvent>[]
): WithTimestamp<IncludedEncryptedNote>[] {
  return joinSplitEvents.flatMap(({ inner, timestampUnixMillis }) => {
    const {
      newNoteAIndex,
      newNoteBIndex,
      newNoteAEncrypted,
      newNoteBEncrypted,
      newNoteACommitment,
      newNoteBCommitment,
      encodedAsset,
    } = inner;

    const asset = AssetTrait.decode(encodedAsset);

    const noteA = {
      ...newNoteAEncrypted,
      asset,
      commitment: newNoteACommitment,
      merkleIndex: newNoteAIndex,
    };

    const noteB = {
      ...newNoteBEncrypted,
      asset,
      commitment: newNoteBCommitment,
      merkleIndex: newNoteBIndex,
    };

    return [
      { inner: noteA, timestampUnixMillis },
      { inner: noteB, timestampUnixMillis },
    ];
  });
}
