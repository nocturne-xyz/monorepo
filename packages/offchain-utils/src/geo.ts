import { Request } from "express";
import { Logger } from "winston";
import { Knex } from "knex";
import { cachedFetch } from "./request";
import IORedis from "ioredis";
import "dotenv/config";

const IPQS_BASE_URL = "https://www.ipqualityscore.com/api/json/ip";
const IPQS_API_KEY = process.env.IPQS_API_KEY ?? "";

export interface IPQSResponse {
  success: boolean;
  message: string;
  fraud_score: number;
  country_code: string;
  region: string;
  city: string;
  ISP: string;
  ASN: number;
  organization: string;
  is_crawler: boolean;
  timezone: string;
  mobile: boolean;
  host: string;
  proxy: boolean;
  vpn: boolean;
  tor: boolean;
  active_vpn: boolean;
  active_tor: boolean;
  recent_abuse: boolean;
  bot_status: boolean;
  connection_type: string;
  abuse_velocity: string;
  zip_code: string;
  latitude: number;
  longitude: number;
  request_id: string;
}

export interface GeoOptions {
  logger: Logger;
  pool: Knex;
}

export interface CleanRequest {
  method: string;
  url: string;
  headers: { [key: string]: string };
  query: { [key: string]: any };
  body: any;
  params: { [key: string]: any };
  ip: string;
  xForwardedFor?: string; // Hoisted X-Forwarded-For
}

export interface DbRequest {
  id: string;
  request: CleanRequest;
  is_flagged: boolean;
  created_at: Date;
}

/**
 * This function takes a request and returns a JSON object with the data
 * from the request that we want to store in the database.
 *
 * @param request
 */
export function requestToCleanJson(request: Request): CleanRequest {
  // This header code may seem a little odd but due to the way http headers are
  //  represented in the http protocol there may be more than one value for a
  //  given header.
  const cleanHeaders: { [key: string]: string } = {};
  let xForwardedFor: string | undefined = undefined;
  for (const [key, value] of Object.entries(request.headers)) {
    if (!value) {
      continue;
    }
    const valuesArray = Array.isArray(value) ? value : [value];
    const finalValue = valuesArray[valuesArray.length - 1];
    cleanHeaders[key] = finalValue;
    if (key.toLowerCase() === "x-forwarded-for") {
      xForwardedFor = finalValue;
    }
  }

  // Remove sensitive headers
  delete cleanHeaders["authorization"];
  delete cleanHeaders["cookie"];
  delete cleanHeaders["x-csrf-token"];
  delete cleanHeaders["x-xsrf-token"];
  delete cleanHeaders["x-csrf"];
  delete cleanHeaders["x-xsrf"];

  // todo: consider GDPR compliance with respect to IP address
  return {
    method: request.method,
    url: request.url,
    headers: cleanHeaders,
    query: request.query,
    body: request.body, // assuming you're using a body-parser middleware
    params: request.params,
    ip: request.ip, // most likely this will not be useful as it will come from the load balancer
    xForwardedFor: Array.isArray(xForwardedFor)
      ? xForwardedFor[0]
      : xForwardedFor,
  };
}

export async function maybeStoreRequest(
  req: Request,
  cache: IORedis,
  options: GeoOptions
): Promise<boolean> {
  const url = `${IPQS_BASE_URL}?ip=${req.ip}`;
  const requestInit = {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "IPQS-KEY": `${IPQS_API_KEY}`,
    },
  };

  options.logger.info("Fetching IPQS response", { url, requestInit });
  const response = await cachedFetch(url, requestInit, cache);
  const ipqsResponse = (await response.json()) as IPQSResponse;
  options.logger.info("IPQS response", { ipqsResponse });

  // Store request in db if anonymous IP detected
  if (
    ipqsResponse.proxy ||
    ipqsResponse.vpn ||
    ipqsResponse.tor ||
    ipqsResponse.active_vpn ||
    ipqsResponse.active_tor
  ) {
    options.logger.info("Storing web request in db for sender", {
      ipqsResponse,
    });
    const cleanedRequest = requestToCleanJson(req);

    // note - autocommit mode is on by default
    await options.pool("requests").insert({
      request: cleanedRequest,
      is_flagged: true,
    });

    return true;
  }

  return false;
}
