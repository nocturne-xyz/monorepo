import { Request, Response, NextFunction } from "express";
import { Logger } from "winston";
import { Knex } from "knex";

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
    options.logger.info(`WAF headers: ${JSON.stringify(req.headers)}}`);
    const wafHeaders = Object.entries(req.headers).filter((h) => {
      return h[0].toLowerCase().startsWith("x-waf-");
    });

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
