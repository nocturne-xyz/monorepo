import IORedis from "ioredis";
import { OpValidationFailure } from "./types";
import { Request, RequestHandler, Response } from "express";
import {
  OperationStatus,
  OperationTrait,
  SubmittableOperationWithNetworkInfo,
  RelayResponse,
  OperationStatusResponse,
  Address,
} from "@nocturne-xyz/core";
import { Handler, Teller } from "@nocturne-xyz/contracts";
import {
  checkIsNotTransferToSanctionedAddress,
  checkNotEnoughGasError,
  checkNullifierConflictError,
  checkRevertError,
} from "./opValidation";
import { BufferDB, NullifierDB, StatusDB } from "./db";
import { ethers } from "ethers";
import { tryParseRelayRequest } from "./request";
import { Logger } from "winston";
import { BundlerServerMetrics } from "./server";
import { Knex } from "knex";
import { maybeStoreRequest } from "@nocturne-xyz/offchain-utils";

export interface HandleRelayDeps {
  buffers: {
    fastBuffer: BufferDB<SubmittableOperationWithNetworkInfo>;
    mediumBuffer: BufferDB<SubmittableOperationWithNetworkInfo>;
    slowBuffer: BufferDB<SubmittableOperationWithNetworkInfo>;
  };
  statusDB: StatusDB;
  nullifierDB: NullifierDB;
  redis: IORedis;
  pool: Knex;
  bundlerAddress: Address;
  tellerContract: Teller;
  handlerContract: Handler;
  provider: ethers.providers.Provider;
  logger: Logger;
  metrics: BundlerServerMetrics;
  opts?: { storeRequestInfo?: boolean; ignoreGas?: boolean };
}

export function makeRelayHandler({
  buffers,
  statusDB,
  nullifierDB,
  redis,
  pool,
  bundlerAddress,
  tellerContract,
  handlerContract,
  provider,
  logger,
  metrics,
  opts,
}: HandleRelayDeps): RequestHandler {
  return async (req: Request, res: Response) => {
    logger.debug("validating request");
    metrics.relayRequestsReceivedCounter.add(1);

    const errorOrRelayRequest = tryParseRelayRequest(req.body);
    if (typeof errorOrRelayRequest == "string") {
      logger.warn("request validation failed", { errorOrRelayRequest });
      res.statusMessage = errorOrRelayRequest;
      res.status(400).json(errorOrRelayRequest);
      return;
    }

    const operation = errorOrRelayRequest.operation;
    const digest = OperationTrait.computeDigest(operation);
    const childLogger = logger.child({ opDigest: digest });

    const logValidationFailure = (msg: string) =>
      childLogger.warn(`failed to validate operation`, { msg });

    childLogger.debug("checking operation's gas price");

    // If option not set, treat as false
    if (opts?.ignoreGas !== true) {
      const gasPriceErr = await checkNotEnoughGasError(
        provider,
        logger,
        operation
      );
      if (gasPriceErr) {
        logValidationFailure(gasPriceErr);
        metrics.opValidationFailuresHistogram.record(1, {
          reason: OpValidationFailure.NotEnoughGas.toString(),
        });
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
      metrics.opValidationFailuresHistogram.record(1, {
        reason: OpValidationFailure.NullifierConflict.toString(),
      });
      res.status(400).json(nfConflictErr);
      return;
    }

    childLogger.debug("validating reverts");
    const revertErr = await checkRevertError(
      bundlerAddress,
      tellerContract,
      handlerContract,
      provider,
      childLogger,
      operation
    );
    if (revertErr) {
      logValidationFailure(revertErr);
      metrics.opValidationFailuresHistogram.record(1, {
        reason: OpValidationFailure.CallRevert.toString(),
      });
      res.status(400).json(revertErr);
      return;
    }

    const sanctionedTransferErr = await checkIsNotTransferToSanctionedAddress(
      provider,
      logger,
      operation
    );
    if (sanctionedTransferErr) {
      logValidationFailure(sanctionedTransferErr);
      // TODO: add histogram for sanctioned transfers?
      res.status(400).json(sanctionedTransferErr);
      return;
    }

    // Enqueue operation and add all inflight nullifiers
    let jobId;
    try {
      jobId = await postJob(
        buffers,
        statusDB,
        nullifierDB,
        redis,
        provider,
        childLogger,
        operation
      );
      metrics.relayRequestsEnqueuedCounter.add(1);
    } catch (err) {
      const msg = "failed to enqueue operation";
      childLogger.error(msg, err);
      res.status(500).json({ error: msg });
      return;
    }

    const response: RelayResponse = { id: jobId };
    res.json(response);

    // If option not set, treat as false
    if (opts?.storeRequestInfo === true) {
      await maybeStoreRequest(req, redis, { pool, logger });
    }
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
        `found operation with digest ${req.params.id} with status: ${status}`,
        { opDigest: req.params.id, status }
      );

      const response: OperationStatusResponse = { status };
      res.json(response);
    } else {
      childLogger.warn(
        `could not find operation with digest ${req.params.id}`,
        { opDigest: req.params.id }
      );
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
    const childLogger = logger.child({ nf: req.params.nullifier });
    const nf = BigInt(req.params.nullifier);

    let exists = false;
    try {
      exists = await nullifierDB.hasNullifierConflict(nf);
    } catch (err) {
      logger.error("failed to check if nullifier exists", { err });
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
  buffers: {
    fastBuffer: BufferDB<SubmittableOperationWithNetworkInfo>;
    mediumBuffer: BufferDB<SubmittableOperationWithNetworkInfo>;
    slowBuffer: BufferDB<SubmittableOperationWithNetworkInfo>;
  },
  statusDB: StatusDB,
  nullifierDB: NullifierDB,
  redis: IORedis,
  provider: ethers.providers.Provider,
  logger: Logger,
  op: SubmittableOperationWithNetworkInfo
): Promise<string> {
  const jobId = OperationTrait.computeDigest(op).toString();

  const gasPrice = (await provider.getGasPrice()).toBigInt();

  if (op.gasPrice >= (gasPrice * 85n) / 100n) {
    // client will pick 100%, 15% buffer for fluctuations
    logger.info("posting op to fast queue", { op });
    await buffers.fastBuffer.add(op);
  } else if (op.gasPrice >= (gasPrice * 60n) / 100n) {
    // client will pick 70%, 10% buffer for fluctuations
    logger.info("posting op to medium queue", { op });
    await buffers.mediumBuffer.add(op);
  } else {
    logger.info("posting op to slow queue", { op });
    await buffers.slowBuffer.add(op);
  }

  const setJobStatusTransaction = statusDB.getSetJobStatusTransaction(
    jobId,
    OperationStatus.QUEUED
  );
  const addNfsTransaction = nullifierDB.getAddNullifierTransactions(op);
  const allTransactions = addNfsTransaction.concat([setJobStatusTransaction]);
  await redis.multi(allTransactions).exec((maybeErr) => {
    if (maybeErr) {
      const msg = `failed to execute set jobs status + add nfs transaction: ${maybeErr}`;
      logger.error(msg, { err: maybeErr });
      throw new Error(msg);
    }
  });
  return jobId;
}
