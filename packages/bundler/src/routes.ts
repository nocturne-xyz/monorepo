import { Queue } from "bullmq";
import IORedis from "ioredis";
import { ProvenOperationJobData, PROVEN_OPERATION_JOB_TAG } from "./common";
import { Request, Response } from "express";
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

export const relayHandler =
  ({
    queue,
    statusDB,
    nullifierDB,
    redis,
    walletContract,
    provider,
    logger,
    opts,
  }: HandleRelayDeps) =>
  async (req: Request, res: Response): Promise<void> => {
    logger.info("validating request");
    const errorOrOperation = tryParseRelayRequest(req.body);
    if (typeof errorOrOperation == "string") {
      logger.info("request validation failed", errorOrOperation);
      res.statusMessage = errorOrOperation;
      res.status(400).json(errorOrOperation);
      return;
    }

    const operation = errorOrOperation;
    const digest = computeOperationDigest(operation);
    logger = logger.child({ opDigest: digest });

    const logValidationFailure = (msg: string) =>
      logger.info(`failed to validate operation `, msg);

    logger.info("checking operation's gas price");

    if (!opts.ignoreGas) {
      const gasPriceErr = await checkNotEnoughGasError(
        provider,
        logger,
        operation
      );
      if (gasPriceErr) {
        logValidationFailure(gasPriceErr);
        res.status(400).json(gasPriceErr);
      }
    }

    logger.info("validating nullifiers");
    const nfConflictErr = await checkNullifierConflictError(
      nullifierDB,
      logger,
      operation
    );
    if (nfConflictErr) {
      logValidationFailure(nfConflictErr);
      res.status(400).json(nfConflictErr);
      return;
    }

    logger.info("validating reverts");
    const revertErr = await checkRevertError(
      walletContract,
      provider,
      logger,
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
      logger,
      operation
    ).catch((err) => {
      const msg = "failed to enqueue operation";
      logger.error(msg, err);
      res.status(500).json({ error: msg });
    });

    res.json({ id: jobId });
  };

export interface HandleGetOperationStatusDeps {
  statusDB: StatusDB;
  logger: Logger;
}

export const getOperationStatusHandler =
  ({ statusDB, logger }: HandleGetOperationStatusDeps) =>
  async (req: Request, res: Response): Promise<void> => {
    logger = logger.child({ opDigest: req.params.id });
    const status = await statusDB.getJobStatus(req.params.id);
    if (status) {
      logger.info(
        `found operation with digest ${req.params.id} with status: ${status}`
      );
      res.json({ status });
    } else {
      logger.info(`could not find operation with digest ${req.params.id}`);
      res.status(404).json({ error: "operation not found" });
    }
  };

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
