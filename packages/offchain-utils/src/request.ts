import { ValidateFunction } from "ajv";
import { ErrString } from "./types";
import retry from "async-retry";
import IORedis from "ioredis";
import { createHash } from "crypto";
import * as JSON from "bigint-json-serialization";
import stableStringify from "json-stable-stringify";

export type CachedFetchOptions = {
  skipCacheRead?: boolean; // default to false
  ttlSeconds?: number; // in seconds, default to 2 hours
  retries?: number; // default to 5
};

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

export async function serializeResponse(response: Response): Promise<string> {
  const serialized: any = {
    status: response.status,
    statusText: response.statusText,
    headers: {},
    body: await response.json(), // assuming response is in JSON format
  };

  response.headers.forEach((value, name) => {
    serialized.headers[name] = value;
  });

  return JSON.stringify(serialized);
}

export function deserializeToResponseString(
  serializedResponseString: string
): Response {
  const parsedData = JSON.parse(serializedResponseString);

  const responseBody = JSON.stringify(parsedData.body); // Assuming the body was stored as JSON
  const headers = new Headers(parsedData.headers);

  return new Response(responseBody, {
    status: parsedData.status,
    statusText: parsedData.statusText,
    headers: headers,
  });
}

export async function cachedFetch(
  requestInfo: RequestInfo,
  requestInit: RequestInit,
  redis: IORedis,
  options: CachedFetchOptions = {}
): Promise<Response> {
  const { skipCacheRead = false, ttlSeconds = 60 * 60, retries = 5 } = options;

  // Generate a cache key based on URL and request payload
  const cacheKey = formatCachedFetchCacheKey(requestInfo, requestInit);

  // Check cache if skipCacheRead false or undefined, return cached data if so
  if (!skipCacheRead) {
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      return deserializeToResponseString(cachedData);
    }
  }

  // Fetch data with retry logic
  const response = await retry(
    async () => {
      return fetch(requestInfo, requestInit);
    },
    { retries }
  );

  if (!response.headers.get("content-type")?.includes("application/json")) {
    throw new Error(`Call failed with message: ${response.statusText}`);
  }

  // Cache response
  await redis.setex(
    cacheKey,
    ttlSeconds,
    await serializeResponse(response.clone())
  );

  return response.clone();
}

export function formatCachedFetchCacheKey(
  requestInfo: RequestInfo,
  requestInit: RequestInit
): string {
  const cacheKeyData = `${
    typeof requestInfo === "string" ? requestInfo : requestInfo.url
  }-${stableStringify(requestInit.body ?? {})}`;
  return `CACHE_${createHash("sha256").update(cacheKeyData).digest("hex")}`;
}
