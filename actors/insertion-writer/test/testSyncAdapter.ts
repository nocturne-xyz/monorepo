import {
  ClosableAsyncIterator,
  IterSyncOpts,
  NocturneSigner,
  range,
  sleep,
} from "@nocturne-xyz/core";
import { TreeInsertionSyncAdapter } from "../src/sync";
import { Insertion } from "../src/sync/syncAdapter";
import {
  randomBigInt,
  DUMMY_ROOT_KEY,
  shitcoin,
} from "@nocturne-xyz/core/test/utils";
import { Note } from "@nocturne-xyz/core/src";

const dummySigner = new NocturneSigner(DUMMY_ROOT_KEY);
const MAX_BATCH_SIZE = 16;
const MAX_BATCH_DELAY = 1000;

export function randomInsertions(): ClosableAsyncIterator<Insertion[]> {
  let closed = false;
  let merkleIndex = 0;
  const generator = async function* () {
    while (!closed) {
      const numInsertions = Math.floor(Math.random() * MAX_BATCH_SIZE);
      const insertions = range(numInsertions).map((i) =>
        randomInsertion(merkleIndex + i)
      );
      merkleIndex += numInsertions;

      yield insertions;

      if (!closed) {
        const sleepDelay = Math.floor(Math.random() * MAX_BATCH_DELAY);
        await sleep(sleepDelay);
      }
    }
  };

  return new ClosableAsyncIterator(generator(), async () => {
    closed = true;
  });
}

export class TestTreeInsertionSyncAdapter implements TreeInsertionSyncAdapter {
  source: ClosableAsyncIterator<Insertion[]>;
  constructor(source: ClosableAsyncIterator<Insertion[]>) {
    this.source = source;
  }

  iterInsertions(
    startMerkleIndex: number,
    _opts?: IterSyncOpts
  ): ClosableAsyncIterator<Insertion[]> {
    return this.source.filter(
      (insertions) =>
        insertions.length > 0 && insertions[0].merkleIndex >= startMerkleIndex
    );
  }
}

function randomInsertion(merkleIndex: number): Insertion {
  if (flipCoin()) {
    return {
      ...randomNote(),
      merkleIndex,
    };
  } else {
    return {
      noteCommitment: randomBigInt(),
      merkleIndex,
    };
  }
}

function randomNote(): Note {
  return {
    owner: dummySigner.generateRandomStealthAddress(),
    nonce: randomBigInt(),
    asset: shitcoin,
    value: randomBigInt(),
  };
}

function flipCoin(): boolean {
  return Math.random() > 0.5;
}
