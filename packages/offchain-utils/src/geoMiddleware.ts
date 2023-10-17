import { Request, Response, NextFunction } from "express";
import { Logger } from "winston";
import { Knex } from "knex";

interface GeoOptions {
  logger: Logger;
  pool: Knex;
}

interface CleanRequest {
  method: string;
  url: string;
  headers: { [key: string]: string };
  query: { [key: string]: any };
  body: any;
  params: { [key: string]: any };
  ip: string;
  xForwardedFor?: string; // Hoisted X-Forwarded-For
}

/**
 * This function takes a request and returns a JSON object with the data
 * from the request that we want to store in the database.
 *
 * @param request
 */
function requestToCleanJson(request: Request): CleanRequest {
  // This header code may seem a little odd but due to the way http headers are
  //  represented in the http protocol there may be more than one value for a
  //  given header.
  const cleanHeaders: { [key: string]: string } = {};
  let xForwardedFor: string | undefined = undefined;
  for (const [key, value] of Object.entries(request.headers)) {
    if (!value) {
      continue;
    }
    if (key.toLowerCase() === "x-forwarded-for" && value.length > 0) {
      xForwardedFor = value[value.length - 1];
      continue;
    }
    if (value.length > 0) {
      // this is a heuristic, the last value should be the most trusted if any client
      //  decided to try to spoof a header. The last one should be the one that
      //  the load balancer set.
      cleanHeaders[key.toLowerCase()] = value[value.length - 1];
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

/**
 * This middleware is used for geoblocking and geotracking.
 * Upstream, requests are processed via AWS WAF and tagged with headers in the format
 * X-WAF-<managed-rule-group-name>-<rule-name>: true
 *
 * When there is no header the rule did not match.
 *
 * This middleware tracks these rules initially by logging. Eventually we will
 * store this data in a database.
 *
 */
export const geoMiddleware = (options: GeoOptions) => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const wafHeaders = Object.keys(req.headers).filter((header) =>
      header.startsWith("X-WAF-")
    );

    // note - for now we only store waf tagged requests - this could change
    if (wafHeaders.length > 0) {
      const cleanedRequest = requestToCleanJson(req);
      // note - autocommit mode is on by default
      await options.pool("requests").insert({
        request: cleanedRequest,
        is_flagged: true,
      });
      options.logger.info("WAF tags applied", { wafHeaders, cleanedRequest });
    }

    next();
  };
};
