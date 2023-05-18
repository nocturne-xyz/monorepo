import { Request, RequestHandler, Response } from "express";
import { tryParseQuoteRequest } from "./requestValidation";
import { Logger } from "winston";
import {
  WaitEstimator,
  estimateWaitTimeSecondsForExisting,
  estimateWaitTimeSecondsForProspective,
} from "./waitEstimation";
import { ScreenerDelayCalculator } from "./screenerDelay";
import { Address } from "@nocturne-xyz/sdk";
import { ScreeningApi } from "./screening";
import { DepositScreenerDB } from "./db";
import { Queue } from "bullmq";
import { DepositRequestJobData } from "./types";

export interface DepositStatusHandlerDeps {
  db: DepositScreenerDB;
  logger: Logger;
  waitEstimator: WaitEstimator;
  screenerQueue: Queue<DepositRequestJobData>;
  fulfillerQueues: Map<Address, Queue<DepositRequestJobData>>;
}

export function makeDepositStatusHandler({
  logger,
  db,
  waitEstimator,
  screenerQueue,
  fulfillerQueues,
}: DepositStatusHandlerDeps): RequestHandler {
  return async (req: Request, res: Response) => {
    const depositHash = req.params.depositHash;

    const maybeStatus = await db.getDepositRequestStatus(depositHash);
    if (!maybeStatus) {
      const errorMsg = `deposit request with hash ${depositHash} not found`;
      logger.warn(errorMsg);
      res.statusMessage = errorMsg;
      res.status(400).json(errorMsg);
      return;
    }

    let delay: number;
    try {
      delay = await estimateWaitTimeSecondsForExisting(
        { logger, db, waitEstimator, screenerQueue, fulfillerQueues },
        depositHash
      );
    } catch (err) {
      logger.warn(err);
      res.statusMessage = String(err);
      res.status(400).json(err);
      return;
    }

    res.json({ status: maybeStatus, estimatedWaitSeconds: delay });
  };
}

export interface QuoteHandlerDeps {
  logger: Logger;
  screeningApi: ScreeningApi;
  screenerDelayCalculator: ScreenerDelayCalculator;
  waitEstimator: WaitEstimator;
  supportedAssets: Map<Address, string>;
}

export function makeQuoteHandler({
  logger,
  screeningApi,
  screenerDelayCalculator,
  waitEstimator,
  supportedAssets,
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

    if (!supportedAssets.has(quoteRequest.assetAddr)) {
      const errorMsg = `asset ${quoteRequest.assetAddr} is not supported`;
      logger.warn(errorMsg);
      res.statusMessage = errorMsg;
      res.status(400).json(errorMsg);
      return;
    }

    let quote: number;
    try {
      quote = await estimateWaitTimeSecondsForProspective(
        {
          screeningApi,
          screenerDelayCalculator,
          waitEstimator,
        },
        quoteRequest.spender,
        quoteRequest.assetAddr,
        quoteRequest.value
      );
    } catch (err) {
      logger.warn(err);
      res.statusMessage = String(err);
      res.status(400).json(err);
      return;
    }

    res.json({ estimatedWaitSeconds: quote });
  };
}
