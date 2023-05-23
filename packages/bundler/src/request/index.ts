import { RelayRequest } from "@nocturne-xyz/sdk";
import validateRelay from "./relay";
import {
  ErrString,
  checkInputError,
  parseRequestBody,
} from "@nocturne-xyz/offchain-utils";

export function tryParseRelayRequest(body: any): ErrString | RelayRequest {
  const maybeErr = checkInputError(validateRelay, body);
  if (maybeErr) {
    return maybeErr;
  } else {
    return parseRequestBody(body);
  }
}
