import {
  AffinePoint,
  BabyJubJub,
  poseidonBN,
} from "@nocturne-xyz/circuit-utils";
import { SpendingKey, spendPkFromFromSk, vkFromSpendPk } from "./keys";
import { NocturneViewer } from "./viewer";
import { randomFr } from "./utils";

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
    const spendPk = spendPkFromFromSk(sk);
    const [vk, vkNonce] = vkFromSpendPk(spendPk);
    super(vk, vkNonce);

    this.sk = sk;
    this.spendPk = spendPk;
  }

  viewer(): NocturneViewer {
    return new NocturneViewer(this.vk, this.vkNonce);
  }

  sign(m: bigint): NocturneSignature {
    // TODO: make this deterministic
    const r = randomFr();
    const R = BabyJubJub.scalarMul(BabyJubJub.BasePoint, r);
    const c = poseidonBN([this.spendPk.x, R.x, R.y, m]);

    // eslint-disable-next-line
    let z = Fr.reduce(r - (this.sk as any) * c);
    if (z < 0) {
      z += BabyJubJub.PrimeSubgroupOrder;
    }

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
    const cp = poseidonBN([R.x, R.y, m]);
    return c == cp;
  }
}
