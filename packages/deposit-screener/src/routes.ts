import { Request, RequestHandler, Response } from "express";
import { tryParseQuoteRequest } from "./request";
import { Logger } from "winston";
import {
  estimateSecondsUntilDepositCompletion,
  estimateSecondsUntilCompletionForProspectiveDeposit,
} from "./waitEstimation";
import { ScreenerDelayCalculator } from "./screenerDelay";
import {
  Address,
  DepositStatusResponse,
  DepositQuoteResponse,
  DepositRequestStatus,
} from "@nocturne-xyz/sdk";
import { ScreeningApi } from "./screening";
import { DepositScreenerDB } from "./db";
import { Queue } from "bullmq";
import { DepositRequestJobData } from "./types";

export interface DepositStatusHandlerDeps {
  db: DepositScreenerDB;
  logger: Logger;
  screenerQueue: Queue<DepositRequestJobData>;
  fulfillerQueues: Map<Address, Queue<DepositRequestJobData>>;
  rateLimits: Map<Address, bigint>;
}

export function makeDepositStatusHandler({
  logger,
  db,
  screenerQueue,
  fulfillerQueues,
  rateLimits,
}: DepositStatusHandlerDeps): RequestHandler {
  return async (req: Request, res: Response) => {
    const depositHash = req.params.depositHash;
    const status = await db.getDepositRequestStatus(depositHash);

    if (status === DepositRequestStatus.DoesNotExist) {
      const response: DepositStatusResponse = {
        status,
        estimatedWaitSeconds: 0,
      };

      res.json(response);
    }

    let delay: number;
    try {
      delay = await estimateSecondsUntilDepositCompletion(
        { db, screenerQueue, fulfillerQueues, rateLimits },
        depositHash
      );
    } catch (err) {
      logger.warn(err);
      res.statusMessage = "Internal Server Error";
      res.status(500);
      return;
    }

    const response: DepositStatusResponse = {
      status,
      estimatedWaitSeconds: delay,
    };
    res.json(response);
  };
}

export interface QuoteHandlerDeps {
  logger: Logger;
  screeningApi: ScreeningApi;
  screenerDelayCalculator: ScreenerDelayCalculator;
  screenerQueue: Queue<DepositRequestJobData>;
  fulfillerQueues: Map<Address, Queue<DepositRequestJobData>>;
  rateLimits: Map<Address, bigint>;
}

export function makeQuoteHandler({
  logger,
  screeningApi,
  screenerDelayCalculator,
  screenerQueue,
  fulfillerQueues,
  rateLimits,
}: QuoteHandlerDeps): RequestHandler {
  return async (req: Request, res: Response) => {
    const errorOrQuoteRequest = tryParseQuoteRequest(req.body);
    if (typeof errorOrQuoteRequest == "string") {
      logger.warn("request validation failed", errorOrQuoteRequest);
      res.statusMessage = errorOrQuoteRequest;
      res.status(400).json(errorOrQuoteRequest);
      return;
    }

    const quoteRequest = errorOrQuoteRequest;

    if (!rateLimits.has(quoteRequest.assetAddr)) {
      const errorMsg = `asset ${quoteRequest.assetAddr} is not supported`;
      logger.warn(errorMsg);
      res.statusMessage = errorMsg;
      res.status(501).json(errorMsg);
      return;
    }

    let quote: number;
    try {
      quote = await estimateSecondsUntilCompletionForProspectiveDeposit(
        {
          screeningApi,
          screenerDelayCalculator,
          screenerQueue,
          fulfillerQueues,
          rateLimits,
        },
        quoteRequest.spender,
        quoteRequest.assetAddr,
        quoteRequest.value
      );
    } catch (err) {
      logger.warn(err);
      res.statusMessage = "Internal Server Error";
      res.status(500);
      return;
    }

    const response: DepositQuoteResponse = { estimatedWaitSeconds: quote };
    res.json(response);
  };
}
