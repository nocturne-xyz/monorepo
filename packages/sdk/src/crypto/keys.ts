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

export function generateRandomSpendingKey(): bigint {
  const sk_buf = randomBytes(Math.floor(256 / 8));
  return Fr.fromBytes(sk_buf);
}

export function spendPkFromFromSk(sk: SpendingKey): SpendPk {
  return BabyJubJub.scalarMul(BabyJubJub.BasePoint, sk);
}

// returns [vk, vkNonce]
export function vkFromSpendPk(spendPk: SpendPk): [ViewingKey, bigint] {
  let nonce = 1n;
  let vk = poseidonBN([spendPk.x, spendPk.y, nonce]);
  while (vk >= Fr.Modulus) {
    nonce += 1n;
    vk = poseidonBN([spendPk.x, spendPk.y, nonce]);
  }

  return [vk, nonce];
}
