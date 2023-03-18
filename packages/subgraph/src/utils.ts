import { BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";

// assumes txIndex and logIndex are less than 2^32. in practice this is a pretty safe assumption (a block should never have billions of txs/log entries)
// assumption: txIndex and logIndex are less than 2^32.
// in practice this is a pretty safe assumption
// because a block should never have billions of txs or log entries
export function getTotalLogIndex(event: ethereum.Event): BigInt {
  const blockNumber = event.block.number;
  const txIndex = event.transaction.index;
  const logIndex = event.logIndex;

  return blockNumber.leftShift(32).bitOr(txIndex).leftShift(32).bitOr(logIndex);
}

// Bytes(blockNumber << 96 | txIndex << 32 | logIndex << 32 || 96 bytes zeros)
export function getId(totalLogIndex: BigInt): Bytes {
  const without0x = totalLogIndex.toHexString().slice(2);
  const padded = without0x.padStart(96, "0");

  return Bytes.fromHexString("0x" + padded);
}

// Bytes(blockNumber << 96 | txIndex << 32 | logIndex << 32 || entityIndex)
// where `blockNumber`, `txIndex`, and `logIndex` uniquely identify the event
// and `entityIndex` is used to handle cases where a single event produces
// multiple entities (e.g. JoinSplit, which produces four of them)
export function getIdWithEntityIndex(
  totalLogIndex: BigInt,
  entityIndex: number
): Bytes {
  const idNum = totalLogIndex
    .leftShift(32)
    .bitOr(BigInt.fromI32(entityIndex as i32));

  const without0x = idNum.toHexString().slice(2);
  // this leaves 160 bits for `blockNumber`. Plenty
  const padded = without0x.padStart(64, "0");

  return Bytes.fromHexString("0x" + padded);
}
