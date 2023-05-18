import { Queue } from "bullmq";
import { QueueType, WaitEstimator } from "./waitEstimator";
import { DepositRequestJobData } from "../types";

export class QueueWaitEstimator implements WaitEstimator {
  screenerQueue: Queue<DepositRequestJobData>;
  fulfillerQueue: Queue<DepositRequestJobData>;

  constructor(screenerQueue: Queue, fulfillerQueue: Queue) {
    this.screenerQueue = screenerQueue;
    this.fulfillerQueue = fulfillerQueue;
  }

  estimateWaitTime(queue: QueueType, delay: number): Promise<number> {
    queue;
    delay;
    return Promise.resolve(0);
  }
}
