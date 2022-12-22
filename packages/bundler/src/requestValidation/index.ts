import { ProvenOperation } from "@nocturne-xyz/sdk";
import { ValidateFunction } from "ajv";
import { parseRequestBody } from "../utils";
import validateRelay from "./relay";

export type RequestErrString = string;

export function tryParseRelayRequest(
  body: any
): RequestErrString | ProvenOperation {
  const maybeErr = extractRelayError(body);
  if (maybeErr) {
    return maybeErr;
  } else {
    return parseRequestBody(body);
  }
}

function extractRelayError(data: any): RequestErrString | undefined {
  return extractInputError(validateRelay, data);
}

function extractInputError<T>(
  validator: ValidateFunction<T>,
  data: any
): RequestErrString | undefined {
  const valid = validator(data);
  if (!valid) {
    const error = validator.errors![0];
    return JSON.stringify(error);
  }
  return undefined;
}
