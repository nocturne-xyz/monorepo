import * as JSON from "bigint-json-serialization";

export function parseRequestBody(body: any): any {
  return JSON.parse(JSON.stringify(body));
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
