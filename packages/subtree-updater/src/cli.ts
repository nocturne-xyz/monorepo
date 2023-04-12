#! /usr/bin/env node

import { program } from "commander";
import { SubtreeUpdateServer } from "./server";
import { RapidsnarkSubtreeUpdateProver } from "./rapidsnarkProver";
import { ethers } from "ethers";
import * as dotenv from "dotenv";
import { MockSubtreeUpdateProver } from "@nocturne-xyz/sdk";
import { createLogger, format, transports, Logger } from "winston";
import * as Transport from "winston-transport";
import path from "path";

export default async function main(): Promise<void> {
  dotenv.config();

  program
    .requiredOption(
      "--handler-address <string>",
      "address of the handler contract"
    )
    .requiredOption(
      "--zkey-path <string>",
      "path to `subtreeupdate.zkey`, i.e. the proving key for the subtree update circuit"
    )
    .requiredOption(
      "--vkey-path <string>",
      "path to `vkey.json`, the verification key for the subtree update circuit"
    )
    .option(
      "--interval <number>",
      "polling interval for checking for state and attempting to submit proofs",
      parseInt
    )
    .option(
      "--use-mock-prover",
      "use a mock prover instead of rapidsnark. This is useful for testing"
    )
    .option(
      "--fill-batches",
      "every time updater polls, ensure the batch is full by filling it with zeros",
      false
    )
    .option(
      "--prover-path <string>",
      "path to the rapidsnark prover exectuable. After building from the rapidsnark repo, this is typically `rapidsnark/build/prover`"
    )
    .option(
      "--witness-generator-path <string>",
      "path to the C++ witness generator executable. This can be built by running `make` in the `subtreeupdate_cpp` directory emitted by circom"
    )
    .option(
      "--tmp-dir <string>",
      "path to a dirctory to use for rapidsnark intermediate files",
      "./prover-tmp"
    )
    .option(
      "--indexing-start-block <number>",
      "block to start indexing at",
      parseInt
    )
    .option("--dbPath <string>", "path to the store DB files", "./db")
    .option(
      "--log-dir <string>",
      "directory to write logs to",
      "./logs/subtree-updater"
    );

  program.parse();

  const {
    tmpDir,
    dbPath,
    zkeyPath,
    vkeyPath,
    proverPath,
    witnessGeneratorPath,
    handlerAddress,
    useMockProver,
    interval,
    indexingStartBlock,
    fillBatches,
    logDir,
  } = program.opts();

  const rpcUrl = process.env.RPC_URL;
  if (!rpcUrl) {
    throw new Error("RPC_URL env var not set");
  }

  const submitterSecretKey = process.env.TX_SIGNER_KEY;
  if (!submitterSecretKey) {
    throw new Error("TX_SIGNER_KEY env var not set");
  }

  console.log("rpcUrl", rpcUrl);
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(submitterSecretKey, provider);

  let prover;
  if (useMockProver) {
    prover = new MockSubtreeUpdateProver();
  } else {
    if (proverPath === undefined || witnessGeneratorPath === undefined) {
      throw new Error(
        "must provide --prover-path and --witness-generator-path when not using mock prover"
      );
    }
    prover = new RapidsnarkSubtreeUpdateProver(
      proverPath,
      witnessGeneratorPath,
      zkeyPath,
      vkeyPath,
      tmpDir
    );
  }

  const logger = makeLogger(logDir, "server");
  const server = new SubtreeUpdateServer(
    prover,
    handlerAddress,
    dbPath,
    signer,
    logger,
    { indexingStartBlock, interval, fillBatches }
  );

  await server.start();
}

// if `consoleLevel` is undefined, no logs will be emitted to console
// if `consoleLevel` is defined, logs at least as important `consoleLevel` will be emitted to console
export function makeLogger(
  logDir: string,
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
        level: consoleLevel,
      })
    );
  }

  return createLogger({
    // default format
    format: format.combine(format.timestamp(), format.json()),
    // add metadata saying which process this log is coming from
    defaultMeta: { service: "subtree-updater", process },
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

main().catch((e) => console.log(`subtree updater exited with error: ${e}`));
