import { babyjub, poseidon } from "circomlibjs";
import { randomBytes } from "crypto";
import { Scalar } from "ffjavascript";
import { AnonAddress } from "./address";

// TODO: rewrite Babyjub library to have constant time crypto
export class PrivKey {
  userViewingKey: bigint; // a number between 0 and babyjub.subOrder - 1
  spendingPrivateKey: bigint; // a number between 0 and babyjub.subOrder - 1

  constructor(spendPrivateKey: bigint) {
    this.spendPrivateKey = spendPrivateKey;
    const spendPublicKey = babyjub.mulPointEscalar(babyjub.Base8, this.spendPrivateKey);
    const userViewkingKeyNonce = BigInt(1);
    this.userViewingKey = poseidon([spendPublicKey[0], spendPublicKey[1], userViewkingKeyNonce]);
  }

  static genPriv(): PrivKey {
    // TODO make sk acutally uniformly distributed
    const sk_buf = randomBytes(Math.floor(512 / 8));
    const sk = Scalar.fromRprBE(sk_buf, 0, 32) % babyjub.subOrder;
    return new PrivKey(BigInt(sk));
  }

  toAddress(): Address {
    const r_buf = randomBytes(Math.floor(256 / 8));
    const r = Scalar.fromRprBE(r_buf, 0, 32);
    const h1 = babyjub.mulPointEscalar(babyjub.Base8, r);
    const h2 = babyjub.mulPointEscalar(h1, this.vk);
    return AnonAddress.fromArrayForm({ h1, h2 });
  }

  spendPk(): [bigint, bigint] {
    return babyjub.mulPointEscalar(babyjub.Base8, this.sk);
  }
}
