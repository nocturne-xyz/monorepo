import { bytesToNumberLE } from "@noble/curves/abstract/utils";
import { AffinePoint, BabyJubJub } from "./BabyJubJub";
import { poseidon4 } from "./hashes";
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
  sk: SpendingKey;
  spendPk: SpendPk;

  constructor(sk: SpendingKey) {
    const spendPk = deriveSpendPK(sk);
    const [vk, vkNonce] = vkFromSpendPk(spendPk);
    super(vk, vkNonce);

    this.sk = sk;
    this.spendPk = spendPk;
  }

  viewer(): NocturneViewer {
    return new NocturneViewer(this.vk, this.vkNonce);
  }

  // TODO: use appendix sig process
  sign(m: bigint): NocturneSignature {
    // derive signing key and nonce entropy
    const h = ethers.utils.arrayify(ethers.utils.sha512(this.sk));
    const s = h.slice(0, 32);

    // derive nonce
    const x = h.slice(32, 64);
    const v = randomBytes(32);
    const buf = ethers.utils.arrayify(
      ethers.utils.sha512(ethers.utils.concat([x, v, Fr.toBytes(m)]))
    );
    const r = Fr.create(bytesToNumberLE(buf));

    // sign
    const R = BabyJubJub.BasePointExtended.multiply(r).toAffine();
    const c = poseidon4([this.spendPk.x, R.x, R.y, m]);
    const z = Fr.sub(r, Fr.mul(Fr.create(bytesToNumberLE(s)), c));

    return {
      c,
      z,
    };
  }

  static verify(pk: SpendPk, m: bigint, sig: NocturneSignature): boolean {
    const c = sig.c;
    const z = sig.z;
    const Z = BabyJubJub.BasePointExtended.multiplyUnsafe(z);
    const P = BabyJubJub.ExtendedPoint.fromAffine(pk).multiplyUnsafe(c);
    const R = Z.add(P);
    const cp = poseidon4([pk.x, R.x, R.y, m]);
    return Fr.eql(c, cp);
  }
}
