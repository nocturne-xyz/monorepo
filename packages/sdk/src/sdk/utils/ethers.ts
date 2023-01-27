import { Wallet } from "@nocturne-xyz/contracts";
import { TypedEvent } from "@nocturne-xyz/contracts/dist/src/common";
import { BaseContract, ContractReceipt, Event, EventFilter } from "ethers";
import { EventFragment, Result } from "ethers/lib/utils";
import { fakeProvenOperation } from ".";
import {
  PreProofOperation,
  PreSignOperation,
  ProvenOperation,
} from "../../commonTypes";
import { OperationResult } from "../../contract/types";

const CHUNK_SIZE = 2000;

export async function largeQueryInChunks<T extends Result>(
  contract: BaseContract,
  filter: EventFilter,
  from: number,
  to: number
): Promise<TypedEvent<T>[]> {
  const events: TypedEvent<T>[] = [];
  do {
    const finalTo = Math.min(from + CHUNK_SIZE, to);
    const rangeEvents = await contract.queryFilter(filter, from, finalTo);
    from = finalTo;
    events.push(...(rangeEvents as TypedEvent<T>[]));
  } while (from <= to);

  return events;
}

export async function query<T extends Result, C extends BaseContract>(
  contract: C,
  filter: EventFilter,
  from: number,
  to: number
): Promise<TypedEvent<T>[]> {
  return largeQueryInChunks(contract, filter, from, to);
}

export function parseEventsFromContractReceipt(
  receipt: ContractReceipt,
  eventFragment: EventFragment
): Event[] {
  return receipt.events!.filter((e) => {
    return e.eventSignature == eventFragment.format();
  });
}

/**
 * Simulate an operation getting back OperationResult
 * @param op an operation-ish object
 * @param wallet an ethers instance of the wallet contract
 */
export async function simulateOperation(
  op: PreSignOperation | PreProofOperation | ProvenOperation,
  wallet: Wallet
): Promise<OperationResult> {
  // We need to do staticCall, which fails if wallet is connected a signer
  // https://github.com/ethers-io/ethers.js/discussions/3327#discussioncomment-3539505
  // Switching to a regular provider underlying the signer
  if (wallet.signer) {
    wallet = wallet.connect(wallet.provider);
  }

  // Fill-in the some fake proof
  const provenOp = fakeProvenOperation(op);

  // Set gasPrice to 0 so that gas payment does not interfere with amount of
  // assets unwrapped pre gas estimation
  op.gasPrice = 0n;

  // Set dummy parameters which should not affect operation simulation
  const verificationGasForOp = 0n;
  const bundler = wallet.address;

  const result = await wallet.callStatic.processOperation(
    provenOp,
    verificationGasForOp,
    bundler,
    { from: wallet.address }
  );
  const {
    opProcessed,
    failureReason,
    callSuccesses,
    callResults,
    verificationGas,
    executionGas,
    numRefunds,
  } = result;

  return {
    opProcessed,
    failureReason,
    callSuccesses,
    callResults,
    verificationGas: verificationGas.toBigInt(),
    executionGas: executionGas.toBigInt(),
    numRefunds: numRefunds.toBigInt(),
  };
}
