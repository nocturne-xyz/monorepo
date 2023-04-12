import { Queue } from "bullmq";
import IORedis from "ioredis";
import { ProvenOperationJobData, PROVEN_OPERATION_JOB_TAG } from "./common";
import { Request, RequestHandler, Response } from "express";
import {
  OperationStatus,
  computeOperationDigest,
  ProvenOperation,
} from "@nocturne-xyz/sdk";
import { Wallet } from "@nocturne-xyz/contracts";
import {
  checkNotEnoughGasError,
  checkNullifierConflictError,
  checkRevertError,
} from "./opValidation";
import * as JSON from "bigint-json-serialization";
import { NullifierDB, StatusDB } from "./db";
import { ethers } from "ethers";
import { tryParseRelayRequest } from "./requestValidation";
import { Logger } from "winston";

export interface HandleRelayDeps {
  queue: Queue<ProvenOperationJobData>;
  statusDB: StatusDB;
  nullifierDB: NullifierDB;
  redis: IORedis;
  walletContract: Wallet;
  provider: ethers.providers.Provider;
  logger: Logger;
  opts: { ignoreGas?: boolean };
}

export function makeRelayHandler({
  queue,
  statusDB,
  nullifierDB,
  redis,
  walletContract,
  provider,
  logger,
  opts,
}: HandleRelayDeps): RequestHandler {
  return async (req: Request, res: Response) => {
    logger.debug("validating request");
    const errorOrOperation = tryParseRelayRequest(req.body);
    if (typeof errorOrOperation == "string") {
      logger.warn("request validation failed", errorOrOperation);
      res.statusMessage = errorOrOperation;
      res.status(400).json(errorOrOperation);
      return;
    }

    const operation = errorOrOperation;
    const digest = computeOperationDigest(operation);
    const childLogger = logger.child({ opDigest: digest });

    const logValidationFailure = (msg: string) =>
      childLogger.warn(`failed to validate operation `, msg);

    childLogger.debug("checking operation's gas price");

    if (!opts.ignoreGas) {
      const gasPriceErr = await checkNotEnoughGasError(
        provider,
        logger,
        operation
      );
      if (gasPriceErr) {
        logValidationFailure(gasPriceErr);
        res.status(400).json(gasPriceErr);
        return;
      }
    }

    childLogger.debug("validating nullifiers");
    const nfConflictErr = await checkNullifierConflictError(
      nullifierDB,
      childLogger,
      operation
    );
    if (nfConflictErr) {
      logValidationFailure(nfConflictErr);
      res.status(400).json(nfConflictErr);
      return;
    }

    childLogger.debug("validating reverts");
    const revertErr = await checkRevertError(
      walletContract,
      provider,
      childLogger,
      operation
    );
    if (revertErr) {
      logValidationFailure(revertErr);
      res.status(400).json(revertErr);
      return;
    }

    // Enqueue operation and add all inflight nullifiers
    const jobId = await postJob(
      queue,
      statusDB,
      nullifierDB,
      redis,
      childLogger,
      operation
    ).catch((err) => {
      const msg = "failed to enqueue operation";
      childLogger.error(msg, err);
      res.status(500).json({ error: msg });
      return;
    });

    res.json({ id: jobId });
  };
}

export interface HandleGetOperationStatusDeps {
  statusDB: StatusDB;
  logger: Logger;
}

export function makeGetOperationStatusHandler({
  statusDB,
  logger,
}: HandleGetOperationStatusDeps): RequestHandler {
  return async (req: Request, res: Response) => {
    const childLogger = logger.child({ opDigest: req.params.id });
    const status = await statusDB.getJobStatus(req.params.id);
    if (status) {
      childLogger.info(
        `found operation with digest ${req.params.id} with status: ${status}`
      );
      res.json({ status });
    } else {
      childLogger.warn(`could not find operation with digest ${req.params.id}`);
      res.status(404).json({ error: "operation not found" });
    }
  };
}

async function postJob(
  queue: Queue<ProvenOperationJobData>,
  statusDB: StatusDB,
  nullifierDB: NullifierDB,
  redis: IORedis,
  logger: Logger,
  operation: ProvenOperation
): Promise<string> {
  const jobId = computeOperationDigest(operation).toString();
  const operationJson = JSON.stringify(operation);
  const jobData: ProvenOperationJobData = {
    operationJson,
  };

  logger.info("posting op to queue");
  logger.debug("posting op to queue:", { jobData });

  // TODO: race condition between queue.add and redis transaction
  await queue.add(PROVEN_OPERATION_JOB_TAG, jobData, {
    jobId,
  });

  const setJobStatusTransaction = statusDB.getSetJobStatusTransaction(
    jobId,
    OperationStatus.QUEUED
  );
  const addNfsTransaction = nullifierDB.getAddNullifierTransactions(operation);
  const allTransactions = addNfsTransaction.concat([setJobStatusTransaction]);
  await redis.multi(allTransactions).exec((maybeErr) => {
    if (maybeErr) {
      const msg = `failed to execute set jobs status + add nfs transaction: ${maybeErr}`;
      logger.error(msg);
      throw new Error(msg);
    }
  });
  return jobId;
}
