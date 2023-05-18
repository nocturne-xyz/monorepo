import { ValidateFunction } from "ajv";
import { ErrString } from "./types";

export function parseRequestBody(body: any): any {
  return JSON.parse(JSON.stringify(body));
}

export function checkInputError<T>(
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
