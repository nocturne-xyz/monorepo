import { babyjub, poseidon } from "circomlibjs";
import { randomBytes } from "crypto";
import { Scalar } from "ffjavascript";
import { NocturneAddress } from "./address";

// TODO: rewrite Babyjub library to have constant time crypto
export class NocturnePrivKey {
  vk: bigint; // a number between 0 and babyjub.subOrder - 1
  sk: bigint; // a number between 0 and babyjub.subOrder - 1

  constructor(sk: bigint) {
    this.sk = sk;
    const spendPk = babyjub.mulPointEscalar(babyjub.Base8, this.sk);
    const spendPkNonce = BigInt(1);
    this.vk = poseidon([spendPk[0], spendPk[1], spendPkNonce]);
  }

  static genPriv(): NocturnePrivKey {
    // TODO make sk acutally uniformly distributed
    const sk_buf = randomBytes(Math.floor(256 / 8));
    const sk = Scalar.fromRprBE(sk_buf, 0, 32) % babyjub.subOrder;
    return new NocturnePrivKey(BigInt(sk));
  }

  toCanonAddress(): NocturneAddress {
    const addr = babyjub.mulPointEscalar(babyjub.Base8, this.sk);
    return addr;
  }

  toAddress(): NocturneAddress {
    const r_buf = randomBytes(Math.floor(256 / 8));
    const r = Scalar.fromRprBE(r_buf, 0, 32) % babyjub.subOrder;
    const h1 = babyjub.mulPointEscalar(babyjub.Base8, r);
    const h2 = babyjub.mulPointEscalar(h1, this.vk);
    return NocturneAddress.fromArrayForm({ h1, h2 });
  }

  spendPk(): [bigint, bigint] {
    return babyjub.mulPointEscalar(babyjub.Base8, this.sk);
  }
}
