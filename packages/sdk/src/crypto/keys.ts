import {
  AffinePoint,
  BabyJubJub,
  poseidonBN,
} from "@nocturne-xyz/crypto-utils";
import * as ethers from "ethers";
import { randomBytes } from "crypto";

const Fr = BabyJubJub.ScalarField;

export type SpendingKey = Uint8Array;
export type SpendPk = AffinePoint<bigint>;
export type ViewingKey = bigint;

export function generateRandomSpendingKey(): SpendingKey {
  return randomBytes(32);
}

export function deriveSpendPK(rootKey: SpendingKey): SpendPk {
  const h = ethers.utils.arrayify(ethers.utils.sha256(rootKey));
  const sk = Fr.fromEntropy(h.slice(0, 32));
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
