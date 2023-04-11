import IORedis from "ioredis";
import path from "path";
import { createLogger, format, transports, Logger } from "winston";
import * as Transport from "winston-transport";

export function getRedis(): IORedis {
  const redisUrl = process.env.REDIS_URL ?? "localhost:6379";
  const redisPassword = process.env.REDIS_PASSWORD;

  return new IORedis(redisUrl, {
    password: redisPassword,
  });
}

// if `consoleLevel` is undefined, no logs will be emitted to console
// if `consoleLevel` is defined, logs at least as important `consoleLevel` will be emitted to console
export function makeLogger(
  logDir: string,
  process: string,
  consoleLevel?: string
): Logger {
  const logTransports: Transport[] = [
    // write all logs at least as important as `error` to `error.log`
    new transports.File({
      filename: path.join(logDir, "error.log"),
      level: "error",
    }),
    // write all logs at least as important as `info` to `info.log`
    new transports.File({
      filename: path.join(logDir, "info.log"),
      level: "info",
    }),
    // write all logs at least as important as `debug` `debug.log`
    new transports.File({
      filename: path.join(logDir, "debug.log"),
      level: "debug",
    }),

    // in the future, we'll add a transport for our logging service (datadog, axiom, etc) here
  ];

  if (consoleLevel) {
    logTransports.push(
      new transports.Console({
        level: consoleLevel,
      })
    );
  }

  return createLogger({
    format: format.combine(format.timestamp(), format.json()),
    // add metadata saying which process this log is coming from
    defaultMeta: { service: "bundler", process },
    // write all uncaught exceptions to `uncaughtExceptions.log`
    exceptionHandlers: [
      new transports.File({ filename: "uncaughtExpections.log" }),
    ],
    // write all uncaught promise rejections to `uncaughtRejections.log`
    rejectionHandlers: [
      new transports.File({ filename: "uncaughtRejections.log" }),
    ],
    transports: logTransports,
  });
}
