// assumes txIndex and logIndex are less than 2^32. in practice this is a pretty safe assumption (a block should never have billions of txs/log entries)
// assumption: txIndex and logIndex are less than 2^32.
// in practice this is a pretty safe assumption
// because a block should never have billions of txs or log entries
function getTotalLogIndex(
  blockNumber: bigint,
  txIdx: bigint,
  logIdx: bigint
): bigint {
  return (((blockNumber << 32n) | txIdx) << 32n) | logIdx;
}

// Hex string repr of `blockNumber << 96 | txIndex << 64 | logIndex << 32 || entityIndex`
// where `blockNumber`, `txIndex`, and `logIndex` uniquely identify the event
// and `entityIndex` is used to handle cases where a single event produces
// multiple entities (e.g. JoinSplit, which produces four of them)
function getId(totalLogIndex: bigint, entityIndex: number): string {
  const idNum = (totalLogIndex << 32n) | BigInt(entityIndex);
  const without0x = idNum.toString(16);
  // this leaves 160 bits for `blockNumber`. Plenty
  const padded = without0x.padStart(64, "0");

  return "0x" + padded;
}

// function printIdForBlockNumber(blockNumber: bigint) {
//   const totalLogIdx = getTotalLogIndex(blockNumber, 0n, 0n);
//   const id = getId(totalLogIdx, 0);
//   console.log(`entity id for first tx of block ${blockNumber}: ${id}`);
// }

// printIdForBlockNumber(0n);
// printIdForBlockNumber(100n);
