import {
  parseRequestBody,
  ErrString,
  checkInputError,
} from "@nocturne-xyz/offchain-utils";
import validateQuote from "./quote";
import { QuoteRequest } from "./requests";

export function tryParseQuoteRequest(body: any): ErrString | QuoteRequest {
  const maybeErr = checkQuoteError(body);
  if (maybeErr) {
    return maybeErr;
  } else {
    return parseRequestBody(body);
  }
}

function checkQuoteError(data: any): ErrString | undefined {
  return checkInputError(validateQuote, data);
}
