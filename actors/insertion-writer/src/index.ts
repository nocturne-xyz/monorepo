import { TreeInsertionLog } from "@nocturne-xyz/persistent-log";
import IORedis from "ioredis";
import { Logger } from "winston";
import { TreeInsertionSyncAdapter } from "./sync";
import { ActorHandle } from "@nocturne-xyz/offchain-utils";

export * from "./sync";

const INSERTION_LOG_STREAM_NAME = "insertion-log";

export class InsertionWriter {
  adapter: TreeInsertionSyncAdapter;
  logger: Logger;
  insertionLog: TreeInsertionLog;

  constructor(
    // only needs provider, not signer
    syncAdapter: TreeInsertionSyncAdapter,
    redis: IORedis,
    logger: Logger
  ) {
    this.adapter = syncAdapter;
    this.logger = logger;
    this.insertionLog = new TreeInsertionLog(redis, INSERTION_LOG_STREAM_NAME, {
      logger: logger.child({ function: "insertion log" }),
    });
  }

  async start(queryThrottleMs?: number): Promise<ActorHandle> {
    const logTip = await this.insertionLog.getTip();
    this.logger.debug(`current log tip: ${logTip}`);

    this.logger.debug("starting iterator");
    // start a logTip + 1 because we want to start at the next merkle index
    const newInsertionBatches = this.adapter.iterInsertions(
      logTip ? logTip + 1 : 0,
      {
        throttleMs: queryThrottleMs,
      }
    );

    const runProm = (async () => {
      this.logger.debug("starting main loop");
      for await (const insertions of newInsertionBatches.iter) {
        const meta = {
          startMerkleIndex: insertions[0].merkleIndex,
          endMerkleIndex: insertions[insertions.length - 1].merkleIndex,
        };

        this.logger.info(
          `got batch of ${insertions.length} insertions starting at merkle index ${meta.startMerkleIndex}`,
          meta
        );
        await this.insertionLog.push(insertions);
        this.logger.info(
          `pushed batch of ${insertions.length} into insertion log`,
          meta
        );
      }
    })();

    const teardown = async () => {
      this.logger.debug("teardown initiated");
      this.logger.debug("closing insertion iterator...");
      await newInsertionBatches.close();
      this.logger.debug(
        "closed insertion iterator. waiting for main loop to terminate..."
      );
      await runProm;
      this.logger.debug("main loop terminated. teardown complete");
    };

    const promise = (async () => {
      try {
        await runProm;
      } catch (err) {
        this.logger.error("error in insertion writer", { err });
        await teardown();
        throw err;
      }
    })();

    return {
      promise,
      teardown,
    };
  }
}
