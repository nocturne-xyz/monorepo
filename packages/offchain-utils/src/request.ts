import { ValidateFunction } from "ajv";
import { ErrString } from "./types";
import retry from "async-retry";
import IORedis from "ioredis";
import { createHash } from "crypto";
import * as JSON from "bigint-json-serialization";

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

export async function cachedFetchWithRetry<T>(
  requestInfo: RequestInfo,
  requestInit: RequestInit,
  redis: IORedis,
  responseExtractor: (response: any) => T = (response) => response,
  options: CachedFetchOptions = {}
): Promise<T> {
  const { skipCacheRead = false, ttlSeconds = 60 * 60, retries = 5 } = options;

  // Generate a cache key based on URL and request payload
  const cacheKey = formatCachedFetchCacheKey(requestInfo, requestInit);

  // Check cache if skipCacheRead false or undefined, return cached data if so
  if (!skipCacheRead) {
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      return JSON.parse(cachedData);
    }
  }

  // Fetch data with retry logic
  const response = await retry(
    async () => {
      return fetch(requestInfo, requestInit);
    },
    { retries }
  );

  // Cache successful responses (only GET for simplicity, but this can be modified)
  if (requestInit.method === "GET") {
    await redis.setex(cacheKey, ttlSeconds, JSON.stringify(response));
  }

  if (!response.headers.get("content-type")?.includes("application/json")) {
    console.log(await response.text());
    throw new Error(`Call failed with message: ${response.statusText}`);
  }

  return responseExtractor(await response.json());
}

export function formatCachedFetchCacheKey(
  requestInfo: RequestInfo,
  requestInit: RequestInit
): string {
  const cacheKeyData = `${
    typeof requestInfo === "string" ? requestInfo : requestInfo.url
  }-${JSON.stringify(requestInit.body ?? {})}`;
  return `CACHE_${createHash("sha256").update(cacheKeyData).digest("hex")}`;
}
