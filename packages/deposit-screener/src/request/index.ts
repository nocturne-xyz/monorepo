import {
  parseRequestBody,
  ErrString,
  checkInputError,
} from "@nocturne-xyz/offchain-utils";
import validateQuote from "./quote";
import { QuoteRequest } from "@nocturne-xyz/sdk";

export function tryParseQuoteRequest(body: any): ErrString | QuoteRequest {
  const maybeErr = checkInputError(validateQuote, body);
  if (maybeErr) {
    return maybeErr;
  } else {
    return parseRequestBody(body);
  }
}
