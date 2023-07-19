import {
  AffinePoint,
  BabyJubJub,
  poseidonBN,
} from "@nocturne-xyz/crypto-utils";
import { randomFr } from "./utils";

const Fr = BabyJubJub.ScalarField;

export type SpendPk = AffinePoint<bigint>;
export type SpendingKey = bigint;
export type ViewingKey = bigint;

export function generateRandomSpendingKey(): bigint {
  return randomFr();
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
