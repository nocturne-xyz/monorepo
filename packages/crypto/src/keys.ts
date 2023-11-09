import { AffinePoint, BabyJubJub } from "./BabyJubJub";
import { poseidon3 } from "./hashes";
import * as ethers from "ethers";
import { randomBytes } from "crypto";
import { bytesToNumberLE } from "@noble/curves/abstract/utils";

const Fr = BabyJubJub.ScalarField;

export type SpendingKey = Uint8Array;
export type SpendPk = AffinePoint<bigint>;
export type ViewingKey = bigint;

export function generateRandomSpendingKey(): SpendingKey {
  return randomBytes(32);
}

export function deriveSpendPK(sk: SpendingKey): SpendPk {
  const h = ethers.utils.arrayify(ethers.utils.sha512(sk));
  const s = Fr.create(bytesToNumberLE(h.slice(0, 32)));
  return BabyJubJub.BasePointExtended.multiply(s).toAffine();
}

// returns [vk, vkNonce]
export function vkFromSpendPk(spendPk: SpendPk): [ViewingKey, bigint] {
  let nonce = 1n;
  let vk = poseidon3([spendPk.x, spendPk.y, nonce]);
  while (vk >= Fr.ORDER) {
    nonce += 1n;
    vk = poseidon3([spendPk.x, spendPk.y, nonce]);
  }

  return [vk, nonce];
}
