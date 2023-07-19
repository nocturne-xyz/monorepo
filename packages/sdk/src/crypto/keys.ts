import {
  AffinePoint,
  BabyJubJub,
  poseidonBN,
} from "@nocturne-xyz/crypto-utils";
import * as ethers from "ethers";
import { randomBytes } from "crypto";

const Fr = BabyJubJub.ScalarField;

// 32 secure-random bytes
// the "spending key" is derived from the root key
// as `sk = sha512(rootKey)[0:32]`, then reduced mod Fr.Modulus
// note that modulo bias is not an issue here because we only use spend key to sign
// using Schnorr Signatures, which are ZKPs (any bias here is not leaked)
export type RootKey = Uint8Array;
// spend public key. That is, `sk * BabyJubJub.BasePoint`
export type SpendPk = AffinePoint<bigint>;
// spend viewing key
export type ViewingKey = bigint;

export function generateRandomRootKey(): RootKey {
  return randomBytes(32);
}

export function deriveSpendPK(rootKey: RootKey): SpendPk {
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
