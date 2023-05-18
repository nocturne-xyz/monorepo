import { ProvenOperation } from "@nocturne-xyz/sdk";
import validateRelay from "./relay";
import {
  ErrString,
  checkInputError,
  parseRequestBody,
} from "@nocturne-xyz/offchain-utils";

export function tryParseRelayRequest(body: any): ErrString | ProvenOperation {
  const maybeErr = checkRelayError(body);
  if (maybeErr) {
    return maybeErr;
  } else {
    return parseRequestBody(body);
  }
}

function checkRelayError(data: any): ErrString | undefined {
  return checkInputError(validateRelay, data);
}
