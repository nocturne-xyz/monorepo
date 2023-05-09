import IORedis from "ioredis";

const LEAF_STREAM_KEY = "LEAF_STREAM";
const LEAF_SCAN_BATCH_SIZE = 100_000;

export class LeafDB {
  redis: IORedis;

  constructor(redis: IORedis) {
    this.redis = redis;
  }

  async addLeaves(leaves: bigint[]): Promise<void> {
    let pipeline = this.redis.pipeline();
    for (const leaf of leaves) {
      pipeline = pipeline.xadd(LEAF_STREAM_KEY, "*", leaf.toString());
    }

    await pipeline.exec();
  }

  // iterate over all of the leaves in the db in batches of size at most `LEAF_SCAN_BATCH_SIZE`
  iterAllLeaves(): AsyncIterableIterator<bigint[]> {
    const redis = this.redis;
    let rangeStart = "-";
    const iter = async function* () {
      // if the stream DNE, return
      if (!(await redis.exists(LEAF_STREAM_KEY))) return;

      // iterate over the stream in chunks of size `LEAF_SCAN_BATCH_SIZE`
      while (true) {
        const res = await redis.xrange(
          LEAF_STREAM_KEY,
          rangeStart,
          "+",
          "COUNT",
          LEAF_SCAN_BATCH_SIZE
        );

        // if we've reached the end of the stream, return
        if (res.length === 0) return;

        yield res.map(([_, [noteCommitment]]) => BigInt(noteCommitment));

        // set the next range start to be the element after the last element we just yielded
        // when this inner loop terminates, this will be the next element to yield
        rangeStart = "(" + res[res.length - 1][0];
      }
    };

    return iter();
  }
}
