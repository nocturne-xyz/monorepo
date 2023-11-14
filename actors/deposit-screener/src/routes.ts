import {
  Address,
  DepositQuoteResponse,
  DepositRequestStatus,
  DepositStatusResponse,
} from "@nocturne-xyz/core";
import { Queue } from "bullmq";
import { Request, RequestHandler, Response } from "express";
import { Logger } from "winston";
import { DepositScreenerDB } from "./db";
import { tryParseQuoteRequest } from "./request";
import { ScreeningCheckerApi } from "./screening";
import { DepositEventJobData } from "./types";
import {
  estimateSecondsUntilCompletionForProspectiveDeposit,
  estimateSecondsUntilDepositCompletion,
} from "./waitEstimation";

export interface DepositStatusHandlerDeps {
  db: DepositScreenerDB;
  logger: Logger;
  screenerQueue: Queue<DepositEventJobData>;
  fulfillerQueues: Map<Address, Queue<DepositEventJobData>>;
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
    logger.info("Entered makeDepositStatusHandler", { params: req.params });
    const depositHash = req.params.depositHash;
    const status = await db.getDepositRequestStatus(depositHash);

    if (status === DepositRequestStatus.DoesNotExist) {
      const response: DepositStatusResponse = {
        status,
      };

      res.json(response);
      return;
    }

    let estimatedWaitSeconds: number | undefined;
    try {
      estimatedWaitSeconds = await estimateSecondsUntilDepositCompletion(
        { logger, db, screenerQueue, fulfillerQueues, rateLimits },
        depositHash,
        status
      );
    } catch (err) {
      logger.warn({ err: JSON.stringify(err) });
    }

    const response: DepositStatusResponse = {
      status,
      estimatedWaitSeconds,
    };
    res.json(response);
  };
}

export interface QuoteHandlerDeps {
  logger: Logger;
  screeningApi: ScreeningCheckerApi;
  screenerQueue: Queue<DepositEventJobData>;
  fulfillerQueues: Map<Address, Queue<DepositEventJobData>>;
  rateLimits: Map<Address, bigint>;
}

export function makeQuoteHandler({
  logger,
  screeningApi,
  screenerQueue,
  fulfillerQueues,
  rateLimits,
}: QuoteHandlerDeps): RequestHandler {
  return async (req: Request, res: Response) => {
    logger.info("Entered makeQuoteHandler", { body: req.body });
    const errorOrQuoteRequest = tryParseQuoteRequest(req.body);
    if (typeof errorOrQuoteRequest == "string") {
      logger.warn("request validation failed", { error: errorOrQuoteRequest });
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
          logger,
          screeningApi,
          screenerQueue,
          fulfillerQueues,
          rateLimits,
        },
        quoteRequest.spender,
        quoteRequest.assetAddr,
        quoteRequest.value
      );
    } catch (error) {
      if (error instanceof Error) {
        logger.warn("error in server", { error });
      } else {
        logger.warn("error in server", { error });
      }

      res.status(500).json({ message: "Internal Server Error" });
      return;
    }

    const response: DepositQuoteResponse = { estimatedWaitSeconds: quote };
    res.json(response);
  };
}
