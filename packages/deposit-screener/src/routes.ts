import { Request, RequestHandler, Response } from "express";
import { tryParseQuoteRequest } from "./requestValidation";
import { Logger } from "winston";
import {
  WaitEstimator,
  estimateWaitTimeSecondsForProspective,
} from "./waitEstimation";
import { ScreenerDelayCalculator } from "./screenerDelay";
import { Address } from "@nocturne-xyz/sdk";
import { ScreeningApi } from "./screening";

interface QuoteHandlerDeps {
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
