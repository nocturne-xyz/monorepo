import { ValidateFunction } from "ajv";
import validateRelay from "./relay";

function extractInputError<T>(
  validator: ValidateFunction<T>,
  data: any
): string | undefined {
  const valid = validator(data);
  if (!valid) {
    const error = validator.errors![0];
    return JSON.stringify(error);
  }
  return undefined;
}

export function extractRelayError(data: any): string | undefined {
  return extractInputError(validateRelay, data);
}
