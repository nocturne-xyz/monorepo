import {
  AffinePoint,
  BabyJubJub,
  poseidonBN,
} from "@nocturne-xyz/circuit-utils";
import randomBytes from "randombytes";

const Fr = BabyJubJub.ScalarField;

export type SpendPk = AffinePoint<bigint>;
export type SpendingKey = bigint;
export type ViewingKey = bigint;

export function generateRandomSigningKey(): bigint {
  const sk_buf = randomBytes(Math.floor(256 / 8));
  return Fr.fromBytes(sk_buf);
}

export function spendPkFromFromSk(sk: SpendingKey): SpendPk {
  return BabyJubJub.scalarMul(BabyJubJub.BasePoint, sk);
}

export function vkFromSpendPk(spendPk: SpendPk): ViewingKey {
  const nonce = 1n;
  return poseidonBN([spendPk.x, spendPk.y, nonce]);
}
