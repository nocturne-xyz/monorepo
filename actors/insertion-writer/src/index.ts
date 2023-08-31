import { PersistentLog } from "@nocturne-xyz/persistent-log";
import IORedis from "ioredis";
import { Logger } from "winston";
import { TreeInsertionSyncAdapter } from "./sync";
import {
  merkleIndexFromRedisStreamId,
  merkleIndexToRedisStreamId,
} from "./utils";
import { Insertion } from "./sync/syncAdapter";
import { ActorHandle } from "@nocturne-xyz/offchain-utils";

export * from "./sync";

export class InsertionWriter {
  adapter: TreeInsertionSyncAdapter;
  logger: Logger;
  insertionLog: PersistentLog<Insertion>;

  constructor(
    // only needs provider, not signer
    syncAdapter: TreeInsertionSyncAdapter,
    redis: IORedis,
    logger: Logger
  ) {
    this.adapter = syncAdapter;
    this.logger = logger;
    this.insertionLog = new PersistentLog<Insertion>(redis, "insertion-log", {
      logger: logger.child({ function: "insertion log" }),
    });
  }

  async start(queryThrottleMs?: number): Promise<ActorHandle> {
    const logTip = (await this.insertionLog.getTip()) ?? "0-0";
    this.logger.debug(`current log tip: ${logTip}`);

    const logTipMerkleIndex = merkleIndexFromRedisStreamId(logTip);
    this.logger.debug("starting iterator");
    const newInsertionBatches = this.adapter.iterInsertions(
      logTipMerkleIndex ?? 0,
      { throttleMs: queryThrottleMs }
    );

    const runProm = (async () => {
      this.logger.debug("starting main loop");
      for await (const insertions of newInsertionBatches.iter) {
        const meta = {
          startMerkleIndex: insertions[0].merkleIndex,
          endMerkleIndex: insertions[insertions.length - 1].merkleIndex,
        };

        this.logger.info(`got batch of ${insertions.length} insertions`, meta);
        await this.insertionLog.push(
          insertions.map((insertion) => ({
            inner: insertion,
            id: merkleIndexToRedisStreamId(insertion.merkleIndex),
          }))
        );
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
