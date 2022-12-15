import "mocha";
import { expect } from "chai";
import IORedis from "ioredis";
import { SingleConsumerJobPipeline, TransformFunction } from "../src/pipeline";
import { RedisMemoryServer } from "redis-memory-server";
import { Job } from "../src/types";
import { randomUUID } from "crypto";

const INPUT_QUEUE_NAME = "InputQueue";
const OUTPUT_QUEUE_NAME = "OutputQueue";
interface InputJobData {
  inputNumber: number;
}
interface BatchJobData {
  inputNumbers: number[];
}

describe("JobPipeline", async () => {
  let server: RedisMemoryServer;
  let redis: IORedis;
  let pipeline: SingleConsumerJobPipeline<InputJobData, BatchJobData>;

  const transformFn: TransformFunction<InputJobData, BatchJobData> = (
    inputDatas: InputJobData[]
  ): BatchJobData[] => {
    const id = randomUUID();
    const inputNumbers = inputDatas.map((data) => {
      return data.inputNumber;
    });
    return [
      {
        inputNumbers,
      },
    ];
  };

  before(async () => {
    server = await RedisMemoryServer.create();

    const host = await server.getHost();
    const port = await server.getPort();
    redis = new IORedis(port, host);
    pipeline = new SingleConsumerJobPipeline(
      INPUT_QUEUE_NAME,
      OUTPUT_QUEUE_NAME,
      transformFn,
      2,
      redis
    );
  });

  beforeEach(async () => {
    await redis.flushall();
  });

  after(async () => {
    redis.disconnect();
    await server.stop();
  });
});
