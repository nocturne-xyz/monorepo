import { ethers } from "ethers";
import {
  Bundle,
  computeOperationDigest,
  SubmittableOperationWithNetworkInfo,
} from "@nocturne-xyz/sdk";
import { Teller } from "@nocturne-xyz/contracts";
import { NullifierDB } from "./db";
import { Logger } from "winston";
import { ErrString } from "@nocturne-xyz/offchain-utils";

export async function checkNullifierConflictError(
  db: NullifierDB,
  logger: Logger,
  operation: SubmittableOperationWithNetworkInfo
): Promise<ErrString | undefined> {
  const opNfSet = new Set<bigint>();

  // Ensure no overlap in given operation
  logger.debug("checking in-op conflicts");
  for (const { nullifierA, nullifierB } of operation.joinSplits) {
    if (opNfSet.has(nullifierA)) {
      return `conflicting nullifier in operation: ${nullifierA}`;
    }
    opNfSet.add(nullifierA);

    if (opNfSet.has(nullifierB)) {
      return `conflicting nullifier in operation: ${nullifierB}`;
    }
    opNfSet.add(nullifierB);
  }

  // Ensure no overlap with other nfs already in queue
  logger.debug("checking in-queue conflicts");
  for (const nf of opNfSet) {
    const conflict = await db.hasNullifierConflict(nf);
    if (conflict) {
      return `nullifier ${nf} already in another operation in queue`;
    }
  }

  return undefined;
}

export async function checkRevertError(
  tellerContract: Teller,
  provider: ethers.providers.Provider,
  logger: Logger,
  operation: SubmittableOperationWithNetworkInfo
): Promise<ErrString | undefined> {
  logger.debug("simulating operation", { operation });
  const bundle: Bundle = { operations: [operation] };

  try {
    const data = tellerContract.interface.encodeFunctionData("processBundle", [
      bundle,
    ]);

    const est = await provider.estimateGas({
      to: tellerContract.address,
      data,
    });

    logger.info("operation gas estimate: ", { est: est.toBigInt() });
    return undefined;
  } catch (e) {
    return `operation reverts with: ${e}`;
  }
}

export async function checkNotEnoughGasError(
  provider: ethers.providers.Provider,
  logger: Logger,
  operation: SubmittableOperationWithNetworkInfo
): Promise<ErrString | undefined> {
  logger.debug(
    "checking that operation's gas price >= current chain's gas price"
  );
  const gasPrice = (await provider.getGasPrice()).toBigInt();
  if (operation.gasPrice < gasPrice) {
    const id = computeOperationDigest(operation).toString();
    return `operation ${id} gas price too low: ${operation.gasPrice} < current chain's gas price ${gasPrice}`;
  }
}
