import path from "path";
import { createLogger, format, transports, Logger } from "winston";
import * as Transport from "winston-transport";
import { presets } from "winston-humanize-formatter";

// if `consoleLevel` is undefined, no logs will be emitted to console
// if `consoleLevel` is defined, logs at least as important `consoleLevel` will be emitted to console
export function makeLogger(
  logDir: string,
  service: string,
  process: string,
  consoleLevel?: string
): Logger {
  const infoOrWarnFilter = format((info) => {
    return info.level === "info" || info.level === "warn" ? info : false;
  });

  const errorFilter = format((info) => {
    return info.level === "error" ? info : false;
  });

  const debugFilter = format((info) => {
    return info.level === "debug" ? info : false;
  });

  const logTransports: Transport[] = [
    // write `error` logs to `error.log`
    new transports.File({
      format: format.combine(errorFilter(), format.timestamp(), format.json()),
      filename: path.join(logDir, "error.log"),
      level: "error",
    }),

    // write `warn` and `info` logs to `info.log`
    new transports.File({
      format: format.combine(
        infoOrWarnFilter(),
        format.timestamp(),
        format.json()
      ),
      filename: path.join(logDir, "info.log"),
      level: "info",
    }),
    // write `debug` logs `debug.log`
    new transports.File({
      format: (debugFilter(), format.timestamp(), format.json()),
      filename: path.join(logDir, "debug.log"),
      level: "debug",
    }),

    // in the future, we'll add a transport for our logging service (datadog, axiom, etc) here
  ];

  if (consoleLevel) {
    logTransports.push(
      new transports.Console({
        format: format.combine(format.timestamp(), format.json()),
        level: consoleLevel,
      })
    );
  }

  return createLogger({
    // default format
    format: format.combine(format.timestamp(), format.json()),
    // add metadata saying which process this log is coming from
    defaultMeta: { service, process },
    // write all uncaught exceptions to `uncaughtExceptions.log`
    exceptionHandlers: [
      new transports.File({
        filename: path.join(logDir, "uncaughtExpections.log"),
      }),
    ],
    // write all uncaught promise rejections to `uncaughtRejections.log`
    rejectionHandlers: [
      new transports.File({
        filename: path.join(logDir, "uncaughtRejections.log"),
      }),
    ],
    transports: logTransports,
  });
}

export function makeTestLogger(service: string, processName: string): Logger {
  let logLevel = "info";
  if (process.env.LOG_LEVEL) {
    logLevel = process.env.LOG_LEVEL;
  }

  return createLogger({
    format: presets.cli.dev,
    // add metadata saying which process this log is coming from
    defaultMeta: { service, process: processName },
    exceptionHandlers: [
      new transports.Console({
        level: "error",
      }),
    ],
    rejectionHandlers: [
      new transports.Console({
        level: "error",
      }),
    ],
    transports: [
      new transports.Console({
        level: logLevel,
      }),
    ],
  });
}
