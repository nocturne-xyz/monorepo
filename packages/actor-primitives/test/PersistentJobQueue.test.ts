import "mocha";
import { expect } from "chai";
import IORedis from "ioredis";
import { PersistentJobQueue } from "../src/queue";
import { RedisMemoryServer } from "redis-memory-server";

const TEST_QUEUE_NAME = "TestQueue";
interface TestJobData {
  counter: number;
}

describe("PersistentJobQueue", async () => {
  let server: RedisMemoryServer;
  let redis: IORedis;
  let queue: PersistentJobQueue<TestJobData>;

  before(async () => {
    server = await RedisMemoryServer.create();

    const host = await server.getHost();
    const port = await server.getPort();
    redis = new IORedis(port, host);
    queue = new PersistentJobQueue(TEST_QUEUE_NAME, redis);
  });

  beforeEach(async () => {
    await redis.flushall();
  });

  after(async () => {
    redis.disconnect();
    await server.stop();
  });

  it("Pushes and pops single", async () => {
    const initialLen = await queue.length();
    expect(initialLen).to.equal(0);

    await queue.addSingle({ counter: 1 });
    expect(await queue.length()).to.equal(1);

    const peeked = await queue.peek(1);
    expect(peeked[0].data).to.deep.equal({ counter: 1 });

    const popped = await queue.pop(1);
    expect(await queue.length()).to.equal(0);
    expect(popped[0].data).to.deep.equal({ counter: 1 });
  });

  it("Pushes and pops multiple", async () => {
    const jobDatas = [{ counter: 1 }, { counter: 2 }, { counter: 3 }];
    const ids = await queue.addMultiple(jobDatas);
    expect(ids.length).to.equal(3);
    expect(await queue.length()).to.equal(3);

    const peeked = await queue.peek(3);
    const peekedJobDatas = peeked.map((job) => {
      return job.data;
    });
    expect(peekedJobDatas).to.deep.equal(jobDatas);
    expect(await queue.length()).to.equal(3);

    const popped = await queue.pop(2);
    const poppedJobDatas = popped.map((job) => {
      return job.data;
    });
    expect(popped.length).to.equal(2);
    expect(await queue.length()).to.equal(1);
    expect(poppedJobDatas).to.deep.equal(jobDatas.slice(0, 2));

    const peekedFinal = await queue.peek(1);
    const peekedFinalJobDatas = peekedFinal[0].data;
    expect(peekedFinalJobDatas).to.deep.equal({ counter: 3 });
  });

  it("Creates and executes addMultiple transaction", async () => {
    const jobDatas = [{ counter: 1 }, { counter: 2 }, { counter: 3 }];
    const transaction = queue.getAddMultipleTransactions(jobDatas);

    await redis.multi(transaction).exec((err, _) => {
      if (err) {
        throw Error("Transaction failed");
      }
    });
    expect(await queue.length()).to.equal(3);

    const peeked = await queue.peek(3);
    const peekedJobDatas = peeked.map((job) => {
      return job.data;
    });
    expect(peekedJobDatas).to.deep.equal(jobDatas);
  });
});
