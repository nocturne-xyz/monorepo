import { babyjub, poseidon } from "circomlibjs";
import { randomBytes } from "crypto";
import { Scalar } from "ffjavascript";
import { FlaxAddress } from "./address";

// TODO: rewrite Babyjub library to have constant time crypto
export class FlaxPrivKey {
  vk: bigint; // a number between 0 and babyjub.subOrder - 1
  sk: bigint; // a number between 0 and babyjub.subOrder - 1

  constructor(sk: bigint) {
    this.sk = sk;
    const spendPk = babyjub.mulPointEscalar(babyjub.Base8, this.sk);
    const spendPkNonce = BigInt(1);
    this.vk = poseidon([spendPk[0], spendPk[1], spendPkNonce]);
  }

  static genPriv(): FlaxPrivKey {
    // TODO make sk acutally uniformly distributed
    const sk_buf = randomBytes(Math.floor(256 / 8));
    const sk = Scalar.fromRprBE(sk_buf, 0, 32) % babyjub.subOrder;
    return new FlaxPrivKey(BigInt(sk));
  }

  toAddress(): FlaxAddress {
    const r_buf = randomBytes(Math.floor(256 / 8));
    const r = Scalar.fromRprBE(r_buf, 0, 32);
    const h1 = babyjub.mulPointEscalar(babyjub.Base8, r);
    const h2 = babyjub.mulPointEscalar(h1, this.vk);
    return FlaxAddress.fromArrayForm({ h1, h2 });
  }

  spendPk(): [bigint, bigint] {
    return babyjub.mulPointEscalar(babyjub.Base8, this.sk);
  }
}
