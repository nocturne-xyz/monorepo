import { TypedEvent } from "@nocturne-xyz/contracts/dist/src/common";
import { Result } from "ethers/lib/utils";

const U32_MAX = 0xffffffffn;

// a "total entity index" is defined as `blockNumber << 96 | txIdx << 64 | logIdx << 32 | entityIdx `,
// where `blockNumber` is the block number of the block in which the event was emitted,
// `txIdx` is the index of the transaction in the block, `logIdx` is the index of the log in the transaction,
// and `entityIdx` is the index of the entity created by the given event.
//
// entityIdx is necessary because some events create multiple entities (currently, only JoinSplit)
// specifically, for a JoinSplit event, the four entities created are:
//   - nullifier A (entityIdx = 0)
//   - nullifier B (entityIdx = 1)
//   - new encrypted note A (entityIdx = 2)
//   - new encrypted note B (entityIdx = 3)

export type TotalEntityIndex = bigint;
export interface TotalEntityIndexComponents {
  blockNumber: bigint;
  txIdx: bigint;
  logIdx: bigint;
  eventIdx: bigint;
}

export interface WithTotalEntityIndex<T> {
  inner: T;
  totalEntityIndex: TotalEntityIndex;
}

export class TotalEntityIndexTrait {
  public static fromComponents({
    blockNumber,
    txIdx,
    logIdx,
    eventIdx,
  }: Partial<TotalEntityIndexComponents>): TotalEntityIndex {
    return (
      ((blockNumber ?? 0n) << 96n) |
      ((txIdx ?? 0n) << 64n) |
      ((logIdx ?? 0n) << 32n) |
      (eventIdx ?? 0n)
    );
  }

  static convertToBlockNumber(createdAtTotalEntityIndex: bigint): number {
    return Number(this.toComponents(createdAtTotalEntityIndex).blockNumber);
  }

  // return a `TotalEntityIndex` (TEI) corresponding to the given block number
  // if `mode` is `UP_TO`, return the TEI of the 0th event in the block, namely `(blockNumber, 0, 0, 0)`
  // if `mode` is `THROUGH`, return the TEI of the last event in the block, namely `(blockNumber, U32_MAX, U32_MAX, U32_MAX)`
  public static fromBlockNumber(
    blockNumber: number,
    mode: "UP_TO" | "THROUGH" = "THROUGH"
  ): TotalEntityIndex {
    if (mode === "UP_TO") {
      return this.fromComponents({ blockNumber: BigInt(blockNumber) });
    } else {
      return this.fromComponents({
        blockNumber: BigInt(blockNumber),
        txIdx: U32_MAX,
        logIdx: U32_MAX,
        eventIdx: U32_MAX,
      });
    }
  }

  public static toComponents(
    idx: TotalEntityIndex
  ): TotalEntityIndexComponents {
    return {
      blockNumber: idx >> 96n,
      txIdx: (idx >> 64n) & U32_MAX,
      logIdx: (idx >> 32n) & U32_MAX,
      eventIdx: idx & U32_MAX,
    };
  }

  public static toStringPadded(idx: TotalEntityIndex): string {
    return `0x${idx.toString(16).padStart(64, "0")}`;
  }

  public static fromTypedEvent<E extends TypedEvent<A>, A extends Result>(
    event: E
  ): TotalEntityIndex {
    return this.fromComponents({
      blockNumber: BigInt(event.blockNumber),
      txIdx: BigInt(event.transactionIndex),
      logIdx: BigInt(event.logIndex),
      eventIdx: 0n,
    });
  }
}
