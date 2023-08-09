import {
  parseRequestBody,
  ErrString,
  checkInputError,
} from "@nocturne-xyz/offchain-utils";
import validateQuote from "./quote";
import { DepositQuoteRequest } from "@nocturne-xyz/wallet-sdk";

export function tryParseQuoteRequest(
  body: any
): ErrString | DepositQuoteRequest {
  const maybeErr = checkInputError(validateQuote, body);
  if (maybeErr) {
    return maybeErr;
  } else {
    return parseRequestBody(body);
  }
}
