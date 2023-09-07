const U64_MAX = (1n << 64n) - 1n;

// a string of the form `N-M`, where N and M are both decimal-formatted 64-bit unsigned integers
export type RedisStreamId = `${number}-${number}`;
export class RedisStreamIdTrait {
  // checks that the given `id` is well-formed
  static fromString(id: string): RedisStreamId {
    const parts = id.split("-");
    if (parts.length > 2) {
      throw new Error(`Invalid RedisStreamId: ${id}`);
    }
    const [lhs, rhs] = parts;
    const lhsNum = BigInt(lhs);
    const rhsNum = BigInt(rhs);

    if (lhsNum < 0n || rhsNum < 0n) {
      throw new Error(`Invalid RedisStreamId: ${id}`);
    }

    if (lhsNum > U64_MAX || rhsNum > U64_MAX) {
      throw new Error(`Invalid RedisStreamId: ${id}`);
    }

    return id as RedisStreamId;
  }

  static toComponents(id: RedisStreamId): [bigint, bigint] {
    const parts = id.split("-");
    const [lhs, rhs] = parts;
    return [BigInt(lhs), BigInt(rhs)];
  }

  static fromComponents(lhs: bigint, rhs: bigint): RedisStreamId {
    if (lhs < 0n || rhs < 0n) {
      throw new Error(`Invalid RedisStreamId: ${lhs}-${rhs}`);
    }

    if (lhs > U64_MAX || rhs > U64_MAX) {
      throw new Error(`Invalid RedisStreamId: ${lhs}-${rhs}`);
    }
    return `${Number(lhs)}-${Number(rhs)}`;
  }

  static lt(lhs: RedisStreamId, rhs: RedisStreamId): boolean {
    const [lhsL, lhsR] = RedisStreamIdTrait.toComponents(lhs);
    const [rhsL, rhsR] = RedisStreamIdTrait.toComponents(rhs);

    if (lhsL === rhsL) {
      return lhsR < rhsR;
    }

    return lhsL < rhsL;
  }
}

export interface WithRedisStreamId<T> {
  id: RedisStreamId;
  inner: T;
}
