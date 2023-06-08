import { BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";

// assumption: blockNumber is less than 2^160. In practice this is a pretty safe assumption, as that's still a huge number.
//   for perspective, at a 1ms block time, it would take ~4.6 * 10^37 years to produce that many blocks.
//   If humanity still exists at that point, I'm sure they'll have other things to worry about.
// assumption: txIndex and logIndex are less than 2^32. in practice this is a pretty safe assumption (a block should never have billions of txs/log entries)
export function getTotalLogIndex(event: ethereum.Event): BigInt {
  const blockNumber = event.block.number;
  const txIndex = event.transaction.index;
  const logIndex = event.logIndex;

  return blockNumber.leftShift(32).bitOr(txIndex).leftShift(32).bitOr(logIndex);
}

// `blockNumber << 96 | txIndex << 32 | logIndex << 64 || entityIndex`
// where `blockNumber`, `txIndex`, and `logIndex` uniquely identify the event
// and `entityIndex` is used to handle cases where a single event produces
// multiple entities (e.g. JoinSplit, which produces four of them)
export function getTotalEntityIndex(
  totalLogIndex: BigInt,
  entityIndex: number
): BigInt {
  return totalLogIndex.leftShift(32).bitOr(BigInt.fromI32(entityIndex as i32));
}

// converts a bigint to a left-zero-padded 32-byte array, in big-endian order, as a hex string
export function toPaddedHexString(id: BigInt): string {
  const without0x = id.toHexString().slice(2);

  // pad the resulting ID out to 64 nibbles, or 256 bits
  // this leaves 160 bits for `blockNumber`, which is plenty
  return "0x" + without0x.padStart(64, "0");
}
