import "mocha";
import chai, { expect } from "chai";
import sinon from "sinon";
import sinonChai from "sinon-chai";
import { ClosableAsyncIterator } from "../src";
import { randomBigInt } from "./utils";

chai.use(sinonChai);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const sleeper = (next: Function) => {
  let closed = false;
  const iter = async function* () {
    while (!closed) {
      const sleepTime = Number(randomBigInt() % 200n);
      await sleep(sleepTime);
      yield next();
    }
  };

  return new ClosableAsyncIterator(iter(), async () => {
    closed = true;
  });
};

describe("ClosableAsyncIterator", () => {
  it("yields items in correct order", async () => {
    let i = 0;
    const next = sinon.fake(() => i++);
    const iter = sleeper(next);

    let j = 0;
    for await (const item of iter.iter) {
      expect(item).to.equal(j++);

      if (j === 5) break;
    }
  });

  it("yields correct amount of items", async () => {
    const next = sinon.fake(() => 0);
    const iter = sleeper(next);

    let j = 0;
    for await (const _ of iter.iter) {
      if (j++ === 5) break;
    }

    expect(next).to.have.callCount(j);
  });

  it("only proceeds to next item when consumer is ready", async () => {
    const next = sinon.fake(() => 0);
    const iter = sleeper(next);

    let j = 0;
    for await (const _ of iter.iter) {
      expect(next).to.have.callCount(++j);

      if (j === 5) break;
    }
  });

  it("ends iterator after consumer calls close()", async () => {
    const next = sinon.fake(() => 0);
    const iter = sleeper(next);

    // run the iterator for a bit
    let j = 0;
    for await (const _ of iter.iter) {
      if (j++ === 5) break;
    }

    expect(next).to.have.callCount(j);

    // close it
    await iter.close();

    // this loop should never be entered
    for await (const _ of iter.iter) {
      expect.fail("iterator should be empty!");
    }

    // `next` shouldn't be called again
    expect(next).to.have.callCount(j);
  });
});
