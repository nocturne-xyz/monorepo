import IORedis from "ioredis";
import { ClosableAsyncIterator } from "@nocturne-xyz/core";
import * as JSON from "bigint-json-serialization";
import { Logger } from "winston";

const REDIS_BATCH_SIZE = 100;
const REDIS_BATCH_SIZE_STRING = REDIS_BATCH_SIZE.toString();
const U64_MAX = (1n << 64n) - 1n;

interface InsertionLogOptions {
  logger: Logger;
}

// a string of the form `N-M`, where N and M are both decimal-formatted 64-bit unsigned integers
export type RedisStreamId = string;
export class RedisStreamIdTrait {
  // checks that the given `id` is well-formed
  static fromString(id: string): RedisStreamId {
    const parts = id.split("-");
    if (parts.length !== 2) {
      throw new Error(`Invalid RedisStreamId: ${id}`);
    }
    const [lhs, rhs] = parts;
    const lhsNum = BigInt(lhs);
    const rhsNum = BigInt(rhs);

    if (lhsNum < 0n || rhsNum < 0n) {
      throw new Error(`Invalid RedisStreamId: ${id}`);
    }

    if (lhsNum > U64_MAX || rhsNum > U64_MAX) {
      throw new Error(`Invalid RedisStreamId: ${id}`);
    }

    return id;
  }

  static toComponents(id: RedisStreamId): [bigint, bigint] {
    const parts = id.split("-");
    const [lhs, rhs] = parts;
    return [BigInt(lhs), BigInt(rhs)];
  }

  static fromComponents(lhs: bigint, rhs: bigint): RedisStreamId {
    if (lhs < 0n || rhs < 0n) {
      throw new Error(`Invalid RedisStreamId: ${lhs}-${rhs}`);
    }

    if (lhs > U64_MAX || rhs > U64_MAX) {
      throw new Error(`Invalid RedisStreamId: ${lhs}-${rhs}`);
    }
    return `${lhs.toString()}-${rhs.toString()}`;
  }
}

export interface WithRedisStreamId<T> {
  id: RedisStreamId;
  inner: T;
}

export interface ScanOptions {
  // if given, the iterator will only return elements with index > `startId`
  // if this id is >= current tip AND `infinite` is set to `false`, the returned iterator will be empty
  startId?: string;

  // if given, the iterator will only return elements with index < `endId`,
  // and it will terminate once the iterator reaches `endId`
  // if this id > current tip AND `infinite` is set to `false`, this option changes nothing
  endId?: string;

  // if true, returned iterator will scan over all past, present, and future elements
  // if false, returned iterator will terminate once redis returns an empty response
  // defaults to false
  infinite?: boolean;

  // amount of time in milliseconds to block for when waiting for new data until terminating the query and re-trying
  // defaults to 30000 (30 seconds)
  pollTimeout?: number;
}

export class PersistentLog<T> {
  private redis: IORedis;
  private logger?: Logger;
  private streamKey: string;

  constructor(
    redis: IORedis,
    streamKey: string,
    options?: InsertionLogOptions
  ) {
    this.redis = redis;
    this.logger = options?.logger;
    this.streamKey = streamKey;
  }

  async getTip(): Promise<RedisStreamId | undefined> {
    const lastEntry = await this.redis.xrevrange(
      this.streamKey,
      "+",
      "-",
      "COUNT",
      "1"
    );
    if (lastEntry.length > 0) {
      return lastEntry[0][0] as RedisStreamId;
    }
    return undefined;
  }

  async push(elems: WithRedisStreamId<T>[]): Promise<void> {
    this.logger &&
      this.logger.debug(`Pushing ${elems.length} elements via x-add`);
    if (elems.length === 0) {
      return;
    }

    let multi = this.redis.multi();
    for (const { inner, id } of elems) {
      multi = multi.xadd(
        this.streamKey,
        id,
        "inner",
        JSON.stringify({ inner })
      );
    }

    await multi.exec((maybeError) => {
      if (maybeError) {
        this.logger &&
          this.logger.error(`Error pushing elements`, { error: maybeError });

        throw maybeError;
      }

      this.logger && this.logger.debug(`Pushed ${elems.length} elements`);
    });
  }

  // same as before, except `syncAndPipe` was removed from the premises
  scan(options?: ScanOptions): ClosableAsyncIterator<WithRedisStreamId<T>[]> {
    const redis = this.redis;
    const logger = this.logger;
    const streamKey = this.streamKey;

    const pollTimeout = (options?.pollTimeout ?? 30000).toString();

    // include the "BLOCK" argument if `infinite` is true
    const poll = async (lowerBound: RedisStreamId) => {
      if (options?.infinite) {
        const entriesByStream = await redis.xread(
          "COUNT",
          REDIS_BATCH_SIZE_STRING,
          "BLOCK",
          pollTimeout,
          "STREAMS",
          streamKey,
          lowerBound
        );

        // we only care about one stream, and we only care about the entries themselves
        // [0] gets the [key, entries] pair for the 0th stream, [1] gets the entries themselves
        return entriesByStream?.[0][1];
      } else {
        const entriesByStream = await redis.xread(
          "COUNT",
          REDIS_BATCH_SIZE_STRING,
          "STREAMS",
          streamKey,
          lowerBound
        );

        // we only care about one stream, and we only care about the entries themselves
        // [0] gets the [key, entries] pair for the 0th stream, [1] gets the entries themselves
        return entriesByStream?.[0][1];
      }
    };

    // start at `startTotalEntityIndex` if it was given
    let lowerBound = options?.startId ?? "0-0";
    logger && logger.debug(`starting scan from ${lowerBound}`);
    let closed = false;
    const generator = async function* () {
      while (!closed) {
        const entries = await poll(lowerBound);
        // if there's no data and `options.infinite` is `true`, then we
        // should simply poll again, neither yielding nor terminating
        // if there's no data and `options.infinite` is `false`, then
        // we should terminate
        if ((!entries || entries.length === 0) && options?.infinite) {
          continue;
        } else if (!entries || entries.length === 0) {
          break;
        }

        // not necessarily typesafe - we assume the caller pointed it to the right redis stream
        let batch = entries.map(([id, fields]) => {
          const inner = JSON.parse(fields[1]).inner as T;
          return { id, inner };
        });

        // filter out all data >= `options.endId` if given
        if (options?.endId !== undefined) {
          const endId = options.endId;
          batch = batch.filter(({ id }) => id < endId);
          // if there's no more data after filtering, terminate
          if (batch.length == 0) {
            break;
          }
        }

        yield batch;

        const lastId = batch[batch.length - 1].id;
        lowerBound = `${lastId}`;
      }

      // not sure if we need this, but we should probably start doing this in hand-written iters
      // I have a sinking feeling not doing so might cause bugs later down the line
      closed = true;
    };

    return new ClosableAsyncIterator(generator(), async () => {
      closed = true;
    });
  }
}
