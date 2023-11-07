import { ethers } from "ethers";
import {
  Bundle,
  SubmittableOperationWithNetworkInfo,
  OperationTrait,
} from "@nocturne-xyz/core";
import { Handler, Teller } from "@nocturne-xyz/contracts";
import { NullifierDB } from "./db";
import { Logger } from "winston";
import { ErrString } from "@nocturne-xyz/offchain-utils";
import { isErc20TransferAction, parseErc20Transfer } from "./actionParsing";
import { isSanctionedAddress } from "./sanctions.";

export async function checkNullifierConflictError(
  db: NullifierDB,
  logger: Logger,
  operation: SubmittableOperationWithNetworkInfo
): Promise<ErrString | undefined> {
  const opNfSet = new Set<bigint>();

  // Ensure no overlap in given operation
  logger.debug("checking in-op conflicts");
  const allJoinSplits = [
    ...operation.confJoinSplits,
    ...operation.pubJoinSplits.map((pubJoinSplit) => pubJoinSplit.joinSplit),
  ];

  for (const { nullifierA, nullifierB } of allJoinSplits) {
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
  bundlerAddress: string,
  tellerContract: Teller,
  handlerContract: Handler,
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
      from: bundlerAddress,
      data,
    });
    logger.info("operation gas estimate: ", { est: est.toBigInt() });

    const bundler = handlerContract.address;
    const result = await handlerContract.callStatic.handleOperation(
      operation,
      300_000, // upper bound on verification gas needed
      bundler,
      { from: tellerContract.address } // hack to avoid simulation reverting, only teller can call handler
    );

    const { opProcessed, failureReason } = result;
    if (!opProcessed || failureReason) {
      return `operation processing fails with: ${failureReason}`;
    }

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
    const id = OperationTrait.computeDigest(operation).toString();
    return `operation ${id} gas price too low: ${operation.gasPrice} < current chain's gas price ${gasPrice}`;
  }
}

export async function checkIsNotErc20TransferToSanctionedAddress(
  logger: Logger,
  operation: SubmittableOperationWithNetworkInfo
): Promise<ErrString | undefined> {
  logger.debug(
    "checking that operation doesn't contain any ERC20 transfers to a sanctioned address"
  );

  const erc20TransferActions = operation.actions.filter(isErc20TransferAction);
  const opDigest = OperationTrait.computeDigest(operation).toString();
  const results = await Promise.all(
    erc20TransferActions.map(async (action, i) => {
      const { to, amount } = parseErc20Transfer(action);
      if (await isSanctionedAddress(to)) {
        logger.alert("detected ERC20 transfer to sanctioned address", {
          opDigest,
          actionIndex: i,
          recipient: to,
          amount,
          tokenContract: action.contractAddress,
        });
        return true;
      } else {
        return false;
      }
    })
  );

  const sanctionedTransfers = results.filter((result) => result === true);
  if (sanctionedTransfers.length > 0) {
    return `operation ${opDigest} contains ${sanctionedTransfers.length} ERC20 transfer(s) to sanctioned addresses`;
  }
}
