import { ProvenOperation } from "@nocturne-xyz/sdk";
import { ValidateFunction } from "ajv";
import { ErrString } from "../common";
import { parseRequestBody } from "../utils";
import validateRelay from "./relay";

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

function checkInputError<T>(
  validator: ValidateFunction<T>,
  data: any
): ErrString | undefined {
  const valid = validator(data);
  if (!valid) {
    const error = validator.errors![0];
    return JSON.stringify(error);
  }
  return undefined;
}
