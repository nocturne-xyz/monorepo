import { Queue } from "bullmq";
import IORedis from "ioredis";
import { ProvenOperationJobData, PROVEN_OPERATION_JOB_TAG } from "./types";
import { Request, RequestHandler, Response } from "express";
import {
  OperationStatus,
  computeOperationDigest,
  ProvenOperation,
  RelayResponse,
  OperationStatusResponse,
} from "@nocturne-xyz/sdk";
import { Teller } from "@nocturne-xyz/contracts";
import {
  checkNotEnoughGasError,
  checkNullifierConflictError,
  checkRevertError,
} from "./opValidation";
import * as JSON from "bigint-json-serialization";
import { NullifierDB, StatusDB } from "./db";
import { ethers } from "ethers";
import { tryParseRelayRequest } from "./request";
import { Logger } from "winston";

export interface HandleRelayDeps {
  queue: Queue<ProvenOperationJobData>;
  statusDB: StatusDB;
  nullifierDB: NullifierDB;
  redis: IORedis;
  tellerContract: Teller;
  provider: ethers.providers.Provider;
  logger: Logger;
  opts: { ignoreGas?: boolean };
}

export function makeRelayHandler({
  queue,
  statusDB,
  nullifierDB,
  redis,
  tellerContract,
  provider,
  logger,
  opts,
}: HandleRelayDeps): RequestHandler {
  return async (req: Request, res: Response) => {
    logger.debug("validating request");
    const errorOrRelayRequest = tryParseRelayRequest(req.body);
    if (typeof errorOrRelayRequest == "string") {
      logger.warn("request validation failed", errorOrRelayRequest);
      res.statusMessage = errorOrRelayRequest;
      res.status(400).json(errorOrRelayRequest);
      return;
    }

    const operation = errorOrRelayRequest.operation;
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
      tellerContract,
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
    let jobId;
    try {
      jobId = await postJob(
        queue,
        statusDB,
        nullifierDB,
        redis,
        childLogger,
        operation
      );
    } catch (err) {
      const msg = "failed to enqueue operation";
      childLogger.error(msg, err);
      res.status(500).json({ error: msg });
      return;
    }

    const response: RelayResponse = { id: jobId };
    res.json(response);
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

      const response: OperationStatusResponse = { status };
      res.json(response);
    } else {
      childLogger.warn(`could not find operation with digest ${req.params.id}`);
      res.status(404).json({ error: "operation not found" });
    }
  };
}

export interface HandleCheckNFDeps {
  nullifierDB: NullifierDB;
  logger: Logger;
}

export function makeCheckNFHandler({
  nullifierDB,
  logger,
}: HandleCheckNFDeps): RequestHandler {
  return async (req: Request, res: Response) => {
    const childLogger = logger.child({ nf: req.params.nf });
    const nf = BigInt(req.params.nf);

    let exists = false;
    try {
      exists = await nullifierDB.hasNullifierConflict(nf);
    } catch (err) {
      logger.error("failed to check if nullifier exists", err);
      res.status(500).json({ error: "internal server error" });
    }

    if (exists) {
      childLogger.debug("nullifier exists");
    } else {
      childLogger.debug("nullifier does not exist");
    }

    const response = { exists };
    res.json(response);
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
