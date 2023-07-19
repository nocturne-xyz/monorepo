import {
  AffinePoint,
  BabyJubJub,
  poseidonBN,
} from "@nocturne-xyz/crypto-utils";
import { SpendingKey, deriveSpendPK, vkFromSpendPk } from "./keys";
import { NocturneViewer } from "./viewer";
import * as ethers from "ethers";
import randomBytes from "randombytes";

const Fr = BabyJubJub.ScalarField;

export type SpendPk = AffinePoint<bigint>;

export interface NocturneSignature {
  c: bigint;
  z: bigint;
}

export class NocturneSigner extends NocturneViewer {
  rk: SpendingKey;
  spendPk: SpendPk;

  constructor(rootKey: SpendingKey) {
    const spendPk = deriveSpendPK(rootKey);
    const [vk, vkNonce] = vkFromSpendPk(spendPk);
    super(vk, vkNonce);

    this.rk = rootKey;
    this.spendPk = spendPk;
  }

  viewer(): NocturneViewer {
    return new NocturneViewer(this.vk, this.vkNonce);
  }

  // TODO: use appendix sig process
  sign(m: bigint): NocturneSignature {
    // derive signing key and nonce entropy
    const h = ethers.utils.arrayify(ethers.utils.sha256(this.rk));
    const s = h.slice(0, 32);

    // derive nonce
    const x = h.slice(32, 64);
    const v = randomBytes(32);
    const r = Fr.fromEntropy(
      ethers.utils.arrayify(
        ethers.utils.sha256(ethers.utils.concat([x, v, Fr.toBytes(m)]))
      )
    );

    // sign
    const R = BabyJubJub.scalarMul(BabyJubJub.BasePoint, r);
    const c = poseidonBN([this.spendPk.x, R.x, R.y, m]);
    // eslint-disable-next-line
    let z = Fr.reduce(Fr.sub(r, Fr.mul(Fr.fromEntropy(s), c)));

    return {
      c,
      z,
    };
  }

  static verify(pk: SpendPk, m: bigint, sig: NocturneSignature): boolean {
    const c = sig.c;
    const z = sig.z;
    const Z = BabyJubJub.scalarMul(BabyJubJub.BasePoint, z);
    const P = BabyJubJub.scalarMul(pk, c);
    const R = BabyJubJub.add(Z, P);
    const cp = poseidonBN([pk.x, R.x, R.y, m]);
    return c == cp;
  }
}
