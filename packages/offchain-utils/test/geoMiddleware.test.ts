import { expect } from "chai";
import { createPool } from "../src/db";
import { Knex } from "knex";
import * as nodeMocks from "node-mocks-http";
import {
  DbRequest,
  IPQSResponse,
  IPQS_BASE_URL,
  formatCachedFetchCacheKey,
  makeTestLogger,
  maybeStoreRequest,
  requestToCleanJson,
  serializeResponse,
} from "../src";
import { Logger } from "winston";
import { Request } from "express";
import IORedis from "ioredis";
import RedisMemoryServer from "redis-memory-server";
import * as JSON from "bigint-json-serialization";

async function cleanRequestTable(pool: Knex<any, unknown[]>): Promise<void> {
  await pool("requests").delete();
}

function getTestRequest(): Request {
  return nodeMocks.createRequest({
    method: "POST",
    url: "/test",
    headers: {
      "X-Forwarded-For": "123.123.123.123",
      Authorization: "Bearer some_token",
      Cookie: "session_id=abcdef",
      "x-csrf-token": "csrf_token_123",
      "User-Agent": "Mozilla/5.0",
      Accept: "application/json",
      "X-WAF-TEST-HEADER": "true",
    },
    query: {
      q: "search",
    },
    body: {
      name: "John",
      email: "john@example.com",
    },
    params: {
      userId: "12345",
    },
    ip: "125.125.125.125",
  });
}

describe("geo", () => {
  let pool: Knex<any, unknown[]>;
  let logger: Logger;

  let server: RedisMemoryServer;
  let redis: IORedis;

  before(async () => {
    pool = createPool();
    logger = makeTestLogger("test", "test");
    await cleanRequestTable(pool);

    server = await RedisMemoryServer.create();

    const host = await server.getHost();
    const port = await server.getPort();
    redis = new IORedis(port, host);
  });

  after(async () => {
    await cleanRequestTable(pool);
    await pool.destroy();
  });

  it("should convert a request to a clean JSON", () => {
    const mockRequest = getTestRequest();
    const cleanJson = requestToCleanJson(mockRequest);

    // Assertions to match our expectations:
    expect(cleanJson.method).to.equal("POST");
    expect(cleanJson.url).to.equal("/test");
    expect(cleanJson.query).to.deep.equal({ q: "search" });
    expect(cleanJson.body).to.deep.equal({
      name: "John",
      email: "john@example.com",
    });
    expect(cleanJson.params).to.deep.equal({ userId: "12345" });
    expect(cleanJson.ip).to.equal("125.125.125.125");
    expect(cleanJson.xForwardedFor).to.equal("123.123.123.123");

    // Check for sanitized headers
    expect(cleanJson.headers["authorization"]).to.be.undefined;
    expect(cleanJson.headers["cookie"]).to.be.undefined;
    expect(cleanJson.headers["x-csrf-token"]).to.be.undefined;
    expect(cleanJson.headers["user-agent"]).to.equal("Mozilla/5.0");
    expect(cleanJson.headers["accept"]).to.equal("application/json");
  });

  it("should store request if anonymous IP", async () => {
    const testRequest = getTestRequest();

    // Create mock response for ipqs
    const mockedResponseBody: IPQSResponse = {
      success: true,
      message: "OK",
      fraud_score: 0,
      country_code: "US",
      region: "California",
      city: "San Francisco",
      ISP: "Cloudflare",
      ASN: 12345,
      organization: "Cloudflare",
      is_crawler: false,
      timezone: "America/Los_Angeles",
      mobile: false,
      host: "10.10.1239.123",
      proxy: false,
      vpn: true,
      tor: false,
      active_vpn: true, // Set VPN to true
      active_tor: false,
      recent_abuse: false,
      bot_status: false,
      connection_type: "",
      abuse_velocity: "0",
      zip_code: "94107",
      latitude: 37.7697,
      longitude: -122.3933,
      request_id: "12345",
    };
    const mockedResponse = new Response(JSON.stringify(mockedResponseBody), {
      status: 200,
      statusText: "OK",
      headers: {
        "Content-Type": "application/json",
      },
    });
    const serializedResponse = await serializeResponse(mockedResponse);

    // Store response in cache
    const cacheKey = formatCachedFetchCacheKey(
      `${IPQS_BASE_URL}?ip=125.125.125.125`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "IPQS-API-Key": "DUMMY_API_KEY",
        },
      }
    );
    await redis.set(cacheKey, serializedResponse);

    // Call to ipqs will return from cache
    await maybeStoreRequest(testRequest, redis, { pool, logger });

    // Check that request was stored
    const insertedRequest = await pool("requests").select<DbRequest[]>();

    expect(insertedRequest.length).to.equal(1);
    const insertedCleanedRequest = insertedRequest[0].request;
    expect(insertedCleanedRequest).to.deep.equal(
      requestToCleanJson(testRequest)
    );
  });
});
