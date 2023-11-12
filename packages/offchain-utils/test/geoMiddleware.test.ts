import { expect } from "chai";
import { createPool } from "../src/db";
import { Knex } from "knex";
import * as nodeMocks from "node-mocks-http";
import {
  DbRequest,
  geoMiddleware,
  makeTestLogger,
  requestToCleanJson,
} from "../src";
import { Logger } from "winston";
import { Request } from "express";

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

describe("geoMiddleware", () => {
  let pool: Knex<any, unknown[]>;
  let logger: Logger;

  before(async () => {
    pool = createPool();
    logger = makeTestLogger("test", "test");
    await cleanRequestTable(pool);
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

  it("should add a record when a matching waf header is present", async () => {
    const testRequest = getTestRequest();

    const testResponse = nodeMocks.createResponse();

    const geoMiddlewareInstance = geoMiddleware({ pool, logger });

    // run the middleware
    await geoMiddlewareInstance(testRequest, testResponse, () => {});

    // read the state back from the database
    const insertedRequest = await pool("requests").select<DbRequest[]>();

    expect(insertedRequest.length).to.equal(1);
    const insertedCleanedRequest = insertedRequest[0].request;
    expect(insertedCleanedRequest).to.deep.equal(
      requestToCleanJson(testRequest)
    );
  });
});
