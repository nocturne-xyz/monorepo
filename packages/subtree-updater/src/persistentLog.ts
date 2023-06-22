import IORedis from "ioredis";
import { ClosableAsyncIterator, TotalEntityIndex } from "@nocturne-xyz/sdk";
import * as JSON from "bigint-json-serialization";
import { Logger } from "winston";

type WithTotalEntityIndex<T> = {
  inner: T;
  totalEntityIndex: bigint;
};

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

    const pipeline = this.redis.pipeline();
    for (const { inner, totalEntityIndex } of insertions) {
      pipeline.xadd(
        INSERTION_STREAM_KEY,
        formatID(totalEntityIndex),
        "inner",
        JSON.stringify({ inner })
      );
    }

    const res = await pipeline.exec();
    this.logger && this.logger.debug(`executed batch x-add`, { res });
  }

  sync(
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
      ? formatID(startTotalEntityIndex)
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
          const totalEntityIndex = parseID(id);
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
      return parseID(lastEntry[0][0]);
    }
    return 0n;
  }
}

function formatID(totalEntityIndex: TotalEntityIndex): string {
  return `${totalEntityIndex.toString()}-1`;
}

function parseID(id: string): TotalEntityIndex {
  return BigInt(id.split("-")[0]);
}
