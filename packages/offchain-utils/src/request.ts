import { ValidateFunction } from "ajv";
import { ErrString } from "./types";
import fetch, { RequestInfo, RequestInit } from "node-fetch";
import retry from "async-retry";
import IORedis from "ioredis";
import { createHash } from "crypto";
import * as JSON from "bigint-json-serialization";

export type CachedFetchOptions = {
  tryReadFromCache?: boolean; // default to false
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

export async function cachedFetchWithRetry(
  requestInfo: RequestInfo,
  requestInit: RequestInit,
  redis: IORedis,
  options: CachedFetchOptions
): Promise<any> {
  // NOTE: we default to false for tryReadFromCache to avoid cases in screener where dev forgets to
  // set `tryReadFromCache` to false for final screening check, as using cache for final screening
  // check could cause false negative screening results
  const {
    tryReadFromCache = false,
    ttlSeconds = 60 * 60,
    retries = 5,
  } = options;

  // Generate a cache key based on URL and request payload
  const cacheKeyData = `${
    typeof requestInfo === "string" ? requestInfo : requestInfo.url
  }-${JSON.stringify(requestInit.body)}`;
  const cacheKey = createHash("sha256").update(cacheKeyData).digest("hex");

  // Check cache if tryReadFromCache set to true, return cached data if so
  if (tryReadFromCache) {
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      return cachedData;
    }
  }

  // Fetch data with retry logic
  const fetchData = async () => {
    const response = await fetch(requestInfo, requestInit);
    return response.json();
  };
  const data = await retry(fetchData, { retries });

  // Cache successful responses (only GET for simplicity, but this can be modified)
  if (requestInit.method === "GET") {
    await redis.setex(cacheKey, ttlSeconds, JSON.stringify(data));
  }

  return data;
}
