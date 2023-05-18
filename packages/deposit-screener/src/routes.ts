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
  fulfillerQueue: Queue<DepositRequestJobData>;
}

const returnDepositNotFoundError = (
  logger: Logger,
  res: Response,
  depositHash: string
) => {
  const errorMsg = `deposit request with hash ${depositHash} not found`;
  logger.warn(errorMsg);
  res.statusMessage = errorMsg;
  res.status(400).json(errorMsg);
};

export function makeDepositStatusHandler({
  logger,
  db,
  waitEstimator,
  screenerQueue,
  fulfillerQueue,
}: DepositStatusHandlerDeps): RequestHandler {
  return async (req: Request, res: Response) => {
    const depositHash = req.params.depositHash;

    const maybeStatus = await db.getDepositRequestStatus(depositHash);
    if (!maybeStatus) {
      returnDepositNotFoundError(logger, res, depositHash);
      return;
    }

    // TODO: clarify assumptions, estimateWait should never return undefined if we passed
    // maybeStatus check
    const maybeDelay = await estimateWaitTimeSecondsForExisting(
      { logger, db, waitEstimator, screenerQueue, fulfillerQueue },
      depositHash
    );
    if (!maybeDelay) {
      returnDepositNotFoundError(logger, res, depositHash);
      return;
    }

    res.json({ status: maybeStatus, estimatedWaitSeconds: maybeDelay });
  };
}

export interface QuoteHandlerDeps {
  logger: Logger;
  screeningApi: ScreeningApi;
  screenerDelayCalculator: ScreenerDelayCalculator;
  waitEstimator: WaitEstimator;
  supportedAssets: Set<Address>;
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

    const quote = await estimateWaitTimeSecondsForProspective(
      {
        screeningApi,
        screenerDelayCalculator,
        waitEstimator,
      },
      quoteRequest.spender,
      quoteRequest.assetAddr,
      quoteRequest.value
    );

    if (!quote) {
      const errorMsg = `deposit quote failed screening. spender: ${quoteRequest.spender}. asset: ${quoteRequest.assetAddr}. value: ${quoteRequest.value}`;
      logger.warn(errorMsg);
      res.statusMessage = errorMsg;
      res.status(400).json(errorMsg);
      return;
    }

    res.json({ estimatedWaitSeconds: quote });
  };
}
