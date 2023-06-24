import IORedis from "ioredis";
import {
  ClosableAsyncIterator,
  TotalEntityIndex,
  TotalEntityIndexTrait,
  assertOrErr,
  WithTotalEntityIndex,
} from "@nocturne-xyz/sdk";
import * as JSON from "bigint-json-serialization";
import { Logger } from "winston";

const INSERTION_STREAM_KEY = "TREE_INSERTIONS";
const REDIS_BATCH_SIZE = 100;
const REDIS_BATCH_SIZE_STRING = REDIS_BATCH_SIZE.toString();

export class PersistentLog<T> {
  private redis: IORedis;
  private logger?: Logger;

  constructor(redis: IORedis, logger?: Logger) {
    this.redis = redis;
    this.logger = logger;
  }

  async push(insertions: WithTotalEntityIndex<T>[]): Promise<void> {
    this.logger &&
      this.logger.debug(`Pushing ${insertions.length} insertions via x-add`, {
        insertions,
      });
    if (insertions.length === 0) {
      return;
    }

    let multi = this.redis.multi();
    for (const { inner, totalEntityIndex } of insertions) {
      multi = multi.xadd(
        INSERTION_STREAM_KEY,
        formatID(compressTotalEntityIndex(totalEntityIndex)),
        "inner",
        JSON.stringify({ inner })
      );
    }

    await multi.exec((maybeError) => {
      if (maybeError) {
        this.logger &&
          this.logger.error(`Error pushing insertions`, { error: maybeError });

        throw maybeError;
      }

      this.logger &&
        this.logger.debug(`Pushed ${insertions.length} insertions`);
    });
  }

  pipe(
    iterator: ClosableAsyncIterator<WithTotalEntityIndex<T>>
  ): ClosableAsyncIterator<WithTotalEntityIndex<T>> {
    // need to alias `this` bceause generator functions can't be arrow functions
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const log = this;
    let batch: WithTotalEntityIndex<T>[] = [];
    const generator = async function* () {
      for await (const item of iterator.iter) {
        batch.push(item);
        if (batch.length >= REDIS_BATCH_SIZE) {
          await log.push(batch);
          batch = [];
        }
        yield item;
      }

      await log.push(batch);
    };

    return new ClosableAsyncIterator(generator(), async () => {
      await log.push(batch);
      await iterator.close();
    });
  }

  scan(
    startTotalEntityIndex?: TotalEntityIndex
  ): ClosableAsyncIterator<WithTotalEntityIndex<T>> {
    const redis = this.redis;
    const logger = this.logger;
    let closed = false;
    let lowerBound = startTotalEntityIndex
      ? formatID(compressTotalEntityIndex(startTotalEntityIndex))
      : "-";

    logger && logger.debug(`starting scan from ${lowerBound}`);
    const generator = async function* () {
      while (!closed) {
        const entries = await redis.xrange(
          INSERTION_STREAM_KEY,
          lowerBound,
          "+",
          "COUNT",
          REDIS_BATCH_SIZE_STRING
        );
        if (entries.length === 0) {
          break;
        }

        for (const [id, fields] of entries) {
          const totalEntityIndex = decompressTotalEntityIndex(parseID(id));
          const inner = JSON.parse(fields[1]).inner as T;
          yield { inner, totalEntityIndex };
        }

        const lastId = entries[entries.length - 1][0];
        lowerBound = `(${lastId}`;
      }
    };

    return new ClosableAsyncIterator(generator(), async () => {
      closed = true;
    });
  }

  async getLatestTotalEntityIndex(): Promise<TotalEntityIndex> {
    const lastEntry = await this.redis.xrevrange(
      INSERTION_STREAM_KEY,
      "+",
      "-",
      "COUNT",
      "1"
    );
    if (lastEntry.length > 0) {
      return decompressTotalEntityIndex(parseID(lastEntry[0][0]));
    }
    return 0n;
  }
}

// NOTE: this might be broken out into SDK later, but for now, this is the only place where it's used, so it's here
// a TEI is 256 bits, which is too large for a redis stream id, so we define a "compressed" 128-bit version;
// recall that a TEI is a 4-tuple `(blockNumber, txIndex, logIndex, entityIndex)`, where `blockNumber` is 160 bits and the rest are 32 bits
// a "compressed" TEI is the same 4-tuple, but where the block number is 48 bits, txIndex and logIndex are both 32 bits, the entityIndex is 15 bits, and the least-significant bit is always 1
// of course, not all TEIs can be compressed - only those whose respective components fit within their compressed sizes.
//
// to turn it into a redis stream ID, we split it into two 64-bit limbs, and format the ID as `${high}-${low}`. The reason why the least-significant bit is always 1 is that `0-0` is an invalid stream ID.

const U32_MAX = (1n << 32n) - 1n;
const U48_MAX = (1n << 48n) - 1n;
const U64_MAX = (1n << 64n) - 1n;
const U15_MAX = (1n << 15n) - 1n;

export type CompressedTotalEntityIndex = bigint;

function compressTotalEntityIndex(
  totalEntityIndex: TotalEntityIndex
): CompressedTotalEntityIndex {
  const { blockNumber, txIdx, logIdx, eventIdx } =
    TotalEntityIndexTrait.toComponents(totalEntityIndex);

  assertOrErr(
    blockNumber <= U48_MAX,
    "blockNumber must be < 2^48 for CompressedTotalEntityIndex"
  );
  assertOrErr(
    eventIdx <= U15_MAX,
    "entityIdx must be < 2^15 for CompressedTotalEntityIndex"
  );

  return (
    (blockNumber << 80n) |
    (txIdx << 48n) |
    (logIdx << 16n) |
    (eventIdx << 1n) |
    1n
  );
}

function decompressTotalEntityIndex(
  compressedTotalEntityIndex: CompressedTotalEntityIndex
): TotalEntityIndex {
  const blockNumber = compressedTotalEntityIndex >> 80n;
  const txIdx = (compressedTotalEntityIndex >> 48n) & U32_MAX;
  const logIdx = (compressedTotalEntityIndex >> 16n) & U32_MAX;
  const eventIdx = (compressedTotalEntityIndex >> 1n) & U15_MAX;

  return TotalEntityIndexTrait.fromComponents({
    blockNumber,
    txIdx,
    logIdx,
    eventIdx,
  });
}

function formatID(
  compressedTotalEntityIndex: CompressedTotalEntityIndex
): string {
  const hi = compressedTotalEntityIndex >> 64n;
  const lo = compressedTotalEntityIndex & U64_MAX;
  return `${hi.toString()}-${lo.toString()}`;
}

function parseID(id: string): CompressedTotalEntityIndex {
  const [hiString, loString] = id.split("-");
  const hi = BigInt(hiString);
  const lo = BigInt(loString);
  return (hi << 64n) | lo;
}
