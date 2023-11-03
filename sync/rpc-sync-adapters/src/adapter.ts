import {
  Address,
  IncludedEncryptedNote,
  IncludedNote,
  Nullifier,
  EncryptedStateDiff,
  SDKIterSyncOpts,
  SDKSyncAdapter,
  TotalEntityIndex,
  TotalEntityIndexTrait,
  WithTotalEntityIndex,
  ClosableAsyncIterator,
  min,
  max,
  maxArray,
  sleep,
  batchOffsetToLatestMerkleIndexInBatch,
} from "@nocturne-xyz/core";
import { Handler, Handler__factory } from "@nocturne-xyz/contracts";
import {
  fetchJoinSplits,
  fetchLatestFillBatchEndIndexInRange,
  fetchNotesFromRefunds,
  fetchSubtreeUpdateCommits,
  JoinSplitEvent,
} from "./fetch";
import { ethers } from "ethers";

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
    startTotalEntityIndex: TotalEntityIndex,
    opts?: SDKIterSyncOpts
  ): ClosableAsyncIterator<EncryptedStateDiff> {
    const endTotalEntityIndex = opts?.endTotalEntityIndex;
    const handlerContract = this.handlerContract;

    let closed = false;
    const generator = async function* () {
      // sync by block, because that's all the chain gives us.
      // but iterate by total entity index, because that's what logically makes sense for the application
      // so what we do, is maintain both a block number and a total entity index, and filter out events that are outside of the range we're interested in
      //
      // We need to filter because we don't know where the start/end total entity indices will be within a block
      const merkleCount = (await handlerContract.count()).toNumber();
      let latestCommittedMerkleIndex =
        merkleCount !== 0 ? merkleCount - 1 : undefined;

      let from = Number(
        TotalEntityIndexTrait.toComponents(startTotalEntityIndex).blockNumber
      );
      let currTotalEntityIndex =
        startTotalEntityIndex !== 0n ? startTotalEntityIndex : undefined;

      const maybeApplyThrottle = async (to: number) => {
        const isCaughtUp = from > to;
        const sleepDelay = max(opts?.throttleMs ?? 0, isCaughtUp ? 5000 : 0);
        await sleep(sleepDelay);
      };

      while (
        !closed &&
        (!endTotalEntityIndex ||
          !currTotalEntityIndex ||
          currTotalEntityIndex < endTotalEntityIndex)
      ) {
        // set `to` to be the min of `from` + `chunkSize` and the current block number minus `finalityBlocks`
        // if `currentBlock < 0`, then we simply wait and try again - this can occurr if the chain is brand new (e.g. in tests)
        const currentBlock =
          (await handlerContract.provider.getBlockNumber()) -
          (opts?.finalityBlocks ?? 0);
        if (currentBlock < 0) {
          await sleep(5000);
          continue;
        }

        const to = min(from + RPC_MAX_CHUNK_SIZE, currentBlock);
        await maybeApplyThrottle(to);

        // get all events JoinSplit, Refund, and SubtreeUpdate events in the range [`from`, `to`]
        const [
          includedNotes,
          joinSplitEvents,
          subtreeUpdateCommits,
          latestFillBatchEndIndexInRange,
        ] = await Promise.all([
          fetchNotesFromRefunds(handlerContract, from, to),
          fetchJoinSplits(handlerContract, from, to),
          fetchSubtreeUpdateCommits(handlerContract, from, to),
          fetchLatestFillBatchEndIndexInRange(handlerContract, from, to),
        ]);

        // update `latestCommittedMerkleIndex` according to the `SubtreeUpdate` events received
        const treeWasUpdated = subtreeUpdateCommits.length > 0;
        if (treeWasUpdated) {
          latestCommittedMerkleIndex = maxArray(
            subtreeUpdateCommits.map(({ inner: { subtreeBatchOffset } }) => {
              return batchOffsetToLatestMerkleIndexInBatch(subtreeBatchOffset);
            })
          );
        }

        // extract notes and nullifiers
        const nullifiers =
          extractNullifiersFromJoinSplitEvents(joinSplitEvents);
        const encryptedNotes =
          extractEncryptedNotesFromJoinSplitEvents(joinSplitEvents);
        const notes: WithTotalEntityIndex<
          IncludedNote | IncludedEncryptedNote
        >[] = [...includedNotes, ...encryptedNotes];

        notes.sort((a, b) => a.inner.merkleIndex - b.inner.merkleIndex);

        // filter out all notes that dont fall in the range [`currTotalLogIndex`, `endTotalLogIndex`]
        const filteredNotes = notes.filter(
          ({ totalEntityIndex }) =>
            (!currTotalEntityIndex ||
              totalEntityIndex >= currTotalEntityIndex) &&
            (!endTotalEntityIndex || totalEntityIndex <= endTotalEntityIndex)
        );

        // filter out all nullifiers that dont fall in the range [`currTotalLogIndex`, `endTotalLogIndex`]
        const filteredNullifiers = nullifiers.filter(
          ({ totalEntityIndex }) =>
            (!currTotalEntityIndex ||
              totalEntityIndex >= currTotalEntityIndex) &&
            (!endTotalEntityIndex || totalEntityIndex <= endTotalEntityIndex)
        );

        const latestMerkleIndexFromNotes =
          filteredNotes.length > 0
            ? maxArray(
                Array.from(filteredNotes.map((n) => n.inner.merkleIndex))
              )
            : undefined;

        let latestNewlySyncedMerkleIndex: number | undefined;
        if (latestFillBatchEndIndexInRange === undefined) {
          latestNewlySyncedMerkleIndex = latestMerkleIndexFromNotes;
        } else if (latestMerkleIndexFromNotes === undefined) {
          latestNewlySyncedMerkleIndex = latestFillBatchEndIndexInRange;
        } else {
          // both are defined
          latestNewlySyncedMerkleIndex = max(
            latestFillBatchEndIndexInRange,
            latestMerkleIndexFromNotes
          );
        }

        currTotalEntityIndex = TotalEntityIndexTrait.fromComponents({
          blockNumber: BigInt(to),
        });

        // if there are remaining events after filtering OR the tree was updated, yield a diff
        if (nullifiers.length + notes.length > 0 || treeWasUpdated) {
          const diff: EncryptedStateDiff = {
            notes: filteredNotes,
            nullifiers: filteredNullifiers.map((n) => n.inner),
            totalEntityIndex: currTotalEntityIndex,
            latestCommittedMerkleIndex,
            latestNewlySyncedMerkleIndex,
          };
          yield diff;
        }

        // proceed to next block `from` to `to` + 1
        from = to + 1;
      }
    };

    return new ClosableAsyncIterator(generator(), async () => {
      closed = true;
    });
  }

  async getLatestIndexedBlock(): Promise<number> {
    const currentBlock = await this.handlerContract.provider.getBlockNumber();
    return currentBlock;
  }

  async getLatestIndexedMerkleIndex(
    toBlock?: number
  ): Promise<number | undefined> {
    // TODO: figure out a way to do this without relying on `blockTag` - not all nodes support this and the ones that do are much more expensive
    const count = (
      await this.handlerContract.totalCount({
        blockTag: toBlock,
      })
    ).toNumber();

    if (count === 0) {
      return undefined;
    }

    return count - 1;
  }
}

function extractNullifiersFromJoinSplitEvents(
  joinSplitEvents: WithTotalEntityIndex<JoinSplitEvent>[]
): WithTotalEntityIndex<Nullifier>[] {
  return joinSplitEvents.flatMap(
    ({ inner: { oldNoteANullifier, oldNoteBNullifier }, totalEntityIndex }) => {
      return [
        {
          totalEntityIndex,
          inner: oldNoteANullifier,
        },
        {
          totalEntityIndex: totalEntityIndex + 1n,
          inner: oldNoteBNullifier,
        },
      ];
    }
  );
}

function extractEncryptedNotesFromJoinSplitEvents(
  joinSplitEvents: WithTotalEntityIndex<JoinSplitEvent>[]
): WithTotalEntityIndex<IncludedEncryptedNote>[] {
  return joinSplitEvents.flatMap(({ inner, totalEntityIndex }) => {
    const {
      newNoteAIndex,
      newNoteBIndex,
      newNoteAEncrypted,
      newNoteBEncrypted,
      newNoteACommitment,
      newNoteBCommitment,
    } = inner;

    const noteA = {
      totalEntityIndex: totalEntityIndex + 2n,
      inner: {
        ...newNoteAEncrypted,
        commitment: newNoteACommitment,
        merkleIndex: newNoteAIndex,
      },
    };

    const noteB = {
      totalEntityIndex: totalEntityIndex + 3n,
      inner: {
        ...newNoteBEncrypted,
        commitment: newNoteBCommitment,
        merkleIndex: newNoteBIndex,
      },
    };

    return [noteA, noteB];
  });
}
