import {
  Address,
  AssetTrait,
  IncludedEncryptedNote,
  Nullifier,
  WithTimestamp,
} from "../../primitives";
import { min } from "../../utils";
import { ClosableAsyncIterator } from "../closableAsyncIterator";
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
    startBlock: number,
    opts?: IterSyncOpts
  ): ClosableAsyncIterator<EncryptedStateDiff> {
    const chunkSize = opts?.maxChunkSize
      ? min(opts.maxChunkSize, RPC_MAX_CHUNK_SIZE)
      : RPC_MAX_CHUNK_SIZE;
    const endBlock = opts?.endBlock;
    let closed = false;

    const handlerContract = this.handlerContract;
    const generator = async function* () {
      const merkleCount = (await handlerContract.count()).toNumber();
      let lastCommittedMerkleIndex =
        merkleCount !== 0 ? merkleCount - 1 : undefined;
      let from = startBlock;
      while (!closed && (!endBlock || from < endBlock)) {
        let to = from + chunkSize;
        if (endBlock) {
          to = min(to, endBlock);
        }

        // if `to` > current block number, want to only fetch up to current block number
        const currentBlock = await handlerContract.provider.getBlockNumber();
        to = min(to, currentBlock);

        // if `from` > `to`, we've caught up to the tip of the chain
        // `from` can be greater than `to` if `to` was the tip of the chain last iteration,
        // and no new blocks were produced since then
        // sleep for a bit and re-try to avoid spamming the RPC endpoint
        if (from > to) {
          await sleep(5_000);
          continue;
        }

        // fetch event data from chain
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

        // get the latest subtree commit
        if (subtreeUpdateCommits.length > 0) {
          lastCommittedMerkleIndex = maxArray(
            subtreeUpdateCommits.map(({ subtreeBatchOffset }) => {
              return batchOffsetToLatestMerkleIndexInBatch(subtreeBatchOffset);
            })
          );
        }

        const diff: EncryptedStateDiff = {
          notes,
          nullifiers,
          lastCommittedMerkleIndex,
          blockNumber: to,
        };
        yield diff;

        // the next state diff starts at the first block in the next range, `to + 1`
        from = to + 1;

        if (opts?.throttleMs && currentBlock - from > chunkSize) {
          await sleep(opts.throttleMs);
        }
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
