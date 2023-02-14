import { AffinePoint, BabyJubJub, poseidonBN } from "@nocturne-xyz/circuit-utils";
import randomBytes from "randombytes";
import { StealthAddress, CanonAddress, StealthAddressTrait } from "./address";

const Fr = BabyJubJub.ScalarField;

export type SpendPk = AffinePoint<bigint>;

// TODO: rewrite Babyjub library to have constant time crypto
export class NocturnePrivKey {
  vk: bigint; // a number between 0 and babyjub.subOrder - 1
  sk: bigint; // a number between 0 and babyjub.subOrder - 1

  constructor(sk: bigint) {
    this.sk = sk;
    const spendPk = BabyJubJub.scalarMul(BabyJubJub.BasePoint, this.sk);
    const spendPkNonce = BigInt(1);
    this.vk = poseidonBN([spendPk.x, spendPk.y, spendPkNonce]);
  }

  static genPriv(): NocturnePrivKey {
    // TODO make sk acutally uniformly distributed
    const sk_buf = randomBytes(Math.floor(256 / 8));
    const sk = Fr.fromBytes(sk_buf);
    return new NocturnePrivKey(BigInt(sk));
  }

  toCanonAddress(): CanonAddress {
    const addr = BabyJubJub.scalarMul(BabyJubJub.BasePoint, this.vk);
    return addr;
  }

  toCanonAddressStruct(): StealthAddress {
    const canonAddr = this.toCanonAddress();
    return {
      h1X: BabyJubJub.BasePoint.x,
      h1Y: BabyJubJub.BasePoint.y,
      h2X: canonAddr.x,
      h2Y: canonAddr.y,
    };
  }

  toAddress(): StealthAddress {
    const r_buf = randomBytes(Math.floor(256 / 8));
    const r = Fr.fromBytes(r_buf);
    const h1 = BabyJubJub.scalarMul(BabyJubJub.BasePoint, r);
    const h2 = BabyJubJub.scalarMul(h1, this.vk);
    return StealthAddressTrait.fromPoints({ h1, h2 });
  }

  spendPk(): SpendPk {
    return BabyJubJub.scalarMul(BabyJubJub.BasePoint, this.sk);
  }
}
