import { ValidateFunction } from "ajv";
import validateRelay from "./relay";

function extractInputError<T>(
  validator: ValidateFunction<T>,
  data: any
): string | undefined {
  validator(data);
  if (validator.errors) {
    const error = validator.errors[0];
    return JSON.stringify(error);
  }
  return undefined;
}

export function extractRelayError(data: any): string | undefined {
  return extractInputError(validateRelay, data);
}
