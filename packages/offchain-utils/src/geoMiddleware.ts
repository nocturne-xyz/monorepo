import { Request, Response, NextFunction } from "express";
import { Logger } from "winston";

interface GeoOptions {
  logger: Logger;
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
  return (req: Request, res: Response, next: NextFunction): void => {
    const wafHeaders = Object.keys(req.headers).filter((header) =>
      header.startsWith("X-WAF-")
    );
    if (wafHeaders.length > 0) {
      // todo: store this data in a database
      options.logger.info("WAF tags applied", { wafHeaders });
    }

    next();
  };
};
