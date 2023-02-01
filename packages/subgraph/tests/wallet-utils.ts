import { newMockEvent } from "matchstick-as"
import { ethereum, BigInt, Bytes } from "@graphprotocol/graph-ts"
import {
  Initialized,
  InsertNoteCommitments,
  InsertNotes,
  JoinSplit,
  OperationProcessed,
  Refund,
  SubtreeUpdate
} from "../generated/Wallet/Wallet"

export function createInitializedEvent(version: i32): Initialized {
  let initializedEvent = changetype<Initialized>(newMockEvent())

  initializedEvent.parameters = new Array()

  initializedEvent.parameters.push(
    new ethereum.EventParam(
      "version",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(version))
    )
  )

  return initializedEvent
}

export function createInsertNoteCommitmentsEvent(
  commitments: Array<BigInt>
): InsertNoteCommitments {
  let insertNoteCommitmentsEvent = changetype<InsertNoteCommitments>(
    newMockEvent()
  )

  insertNoteCommitmentsEvent.parameters = new Array()

  insertNoteCommitmentsEvent.parameters.push(
    new ethereum.EventParam(
      "commitments",
      ethereum.Value.fromUnsignedBigIntArray(commitments)
    )
  )

  return insertNoteCommitmentsEvent
}

export function createInsertNotesEvent(
  notes: Array<ethereum.Tuple>
): InsertNotes {
  let insertNotesEvent = changetype<InsertNotes>(newMockEvent())

  insertNotesEvent.parameters = new Array()

  insertNotesEvent.parameters.push(
    new ethereum.EventParam("notes", ethereum.Value.fromTupleArray(notes))
  )

  return insertNotesEvent
}

export function createJoinSplitEvent(
  oldNoteANullifier: BigInt,
  oldNoteBNullifier: BigInt,
  newNoteAIndex: BigInt,
  newNoteBIndex: BigInt,
  joinSplitTx: ethereum.Tuple
): JoinSplit {
  let joinSplitEvent = changetype<JoinSplit>(newMockEvent())

  joinSplitEvent.parameters = new Array()

  joinSplitEvent.parameters.push(
    new ethereum.EventParam(
      "oldNoteANullifier",
      ethereum.Value.fromUnsignedBigInt(oldNoteANullifier)
    )
  )
  joinSplitEvent.parameters.push(
    new ethereum.EventParam(
      "oldNoteBNullifier",
      ethereum.Value.fromUnsignedBigInt(oldNoteBNullifier)
    )
  )
  joinSplitEvent.parameters.push(
    new ethereum.EventParam(
      "newNoteAIndex",
      ethereum.Value.fromUnsignedBigInt(newNoteAIndex)
    )
  )
  joinSplitEvent.parameters.push(
    new ethereum.EventParam(
      "newNoteBIndex",
      ethereum.Value.fromUnsignedBigInt(newNoteBIndex)
    )
  )
  joinSplitEvent.parameters.push(
    new ethereum.EventParam(
      "joinSplitTx",
      ethereum.Value.fromTuple(joinSplitTx)
    )
  )

  return joinSplitEvent
}

export function createOperationProcessedEvent(
  operationDigest: BigInt,
  opProcessed: boolean,
  failureReason: string,
  callSuccesses: Array<boolean>,
  callResults: Array<Bytes>
): OperationProcessed {
  let operationProcessedEvent = changetype<OperationProcessed>(newMockEvent())

  operationProcessedEvent.parameters = new Array()

  operationProcessedEvent.parameters.push(
    new ethereum.EventParam(
      "operationDigest",
      ethereum.Value.fromUnsignedBigInt(operationDigest)
    )
  )
  operationProcessedEvent.parameters.push(
    new ethereum.EventParam(
      "opProcessed",
      ethereum.Value.fromBoolean(opProcessed)
    )
  )
  operationProcessedEvent.parameters.push(
    new ethereum.EventParam(
      "failureReason",
      ethereum.Value.fromString(failureReason)
    )
  )
  operationProcessedEvent.parameters.push(
    new ethereum.EventParam(
      "callSuccesses",
      ethereum.Value.fromBooleanArray(callSuccesses)
    )
  )
  operationProcessedEvent.parameters.push(
    new ethereum.EventParam(
      "callResults",
      ethereum.Value.fromBytesArray(callResults)
    )
  )

  return operationProcessedEvent
}

export function createRefundEvent(
  refundAddr: ethereum.Tuple,
  nonce: BigInt,
  encodedAssetAddr: BigInt,
  encodedAssetId: BigInt,
  value: BigInt,
  merkleIndex: BigInt
): Refund {
  let refundEvent = changetype<Refund>(newMockEvent())

  refundEvent.parameters = new Array()

  refundEvent.parameters.push(
    new ethereum.EventParam("refundAddr", ethereum.Value.fromTuple(refundAddr))
  )
  refundEvent.parameters.push(
    new ethereum.EventParam("nonce", ethereum.Value.fromUnsignedBigInt(nonce))
  )
  refundEvent.parameters.push(
    new ethereum.EventParam(
      "encodedAssetAddr",
      ethereum.Value.fromUnsignedBigInt(encodedAssetAddr)
    )
  )
  refundEvent.parameters.push(
    new ethereum.EventParam(
      "encodedAssetId",
      ethereum.Value.fromUnsignedBigInt(encodedAssetId)
    )
  )
  refundEvent.parameters.push(
    new ethereum.EventParam("value", ethereum.Value.fromUnsignedBigInt(value))
  )
  refundEvent.parameters.push(
    new ethereum.EventParam(
      "merkleIndex",
      ethereum.Value.fromUnsignedBigInt(merkleIndex)
    )
  )

  return refundEvent
}

export function createSubtreeUpdateEvent(
  newRoot: BigInt,
  subtreeIndex: BigInt
): SubtreeUpdate {
  let subtreeUpdateEvent = changetype<SubtreeUpdate>(newMockEvent())

  subtreeUpdateEvent.parameters = new Array()

  subtreeUpdateEvent.parameters.push(
    new ethereum.EventParam(
      "newRoot",
      ethereum.Value.fromUnsignedBigInt(newRoot)
    )
  )
  subtreeUpdateEvent.parameters.push(
    new ethereum.EventParam(
      "subtreeIndex",
      ethereum.Value.fromUnsignedBigInt(subtreeIndex)
    )
  )

  return subtreeUpdateEvent
}
