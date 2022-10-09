// @flow

import { babyjub, eddsa, poseidon } from "circomlibjs";
import { randomBytes } from "crypto";
import { Scalar } from "ffjavascript";

// TODO: rewrite Babyjub library to have constant time crypto

export interface FlaxPrivKey {
    vk: BigInt; // a number between 0 and babyjub.subOrder - 1
    sk: BigInt; // a number between 0 and babyjub.subOrder - 1
}

// TODO: Fix binary / base64 format of a FlaxAddr
export interface FlaxAddr {
    H1: [BigInt, BigInt];
    H2: [BigInt, BigInt];
    H3: [BigInt, BigInt];
}

export function genPriv(): FlaxPrivKey {
    // TODO make vk and sk acutally uniformly distributed
    let vk_buf = randomBytes(Math.floor(256 / 8));
    let sk_buf = randomBytes(Math.floor(256 / 8));
    let vk = Scalar.fromRprLE(vk_buf, 0, 32) % babyjub.subOrder;
    let sk = Scalar.fromRprLE(sk_buf, 0, 32) % babyjub.subOrder;
    let priv: FlaxPrivKey = {
        vk: vk,
        sk: sk,
    }
    return priv;
}

export function privToAddr(priv: FlaxPrivKey): FlaxAddr {
    let r_buf = randomBytes(Math.floor(256 / 8));
    let r = Scalar.fromRprLE(r_buf, 0, 32);
    let H1 = babyjub.mulPointEscalar(babyjub.Base8, r);
    let H2 = babyjub.mulPointEscalar(H1, priv.vk);
    let H3 = babyjub.mulPointEscalar(H1, priv.sk);
    let addr: FlaxAddr = {
        H1: H1,
        H2: H2,
        H3: H3,
    }
    return addr;
}

export function testOwn(priv: FlaxPrivKey, addr: FlaxAddr): boolean {
    let H2prime = babyjub.mulPointEscalar(addr.H1, priv.vk);
    return (addr.H2[0] === H2prime[0]) && (addr.H2[1] === H2prime[1]);
}

export function sign(priv: FlaxPrivKey, addr: FlaxAddr, m: BigInt) {
    // TODO: make this deterministic
    let r_buf = randomBytes(Math.floor(256 / 8));
    let r = Scalar.fromRprLE(r_buf, 0, 32);
    let R = babyjub.mulPointEscalar(addr.H1, r);
    let c = poseidon([R[0], R[1], m]);
    let z = (r - priv.sk * c) % babyjub.subOrder;
    if (z < 0) {
        z += babyjub.subOrder
    }
    return [c, z]
}

export function verify(addr: FlaxAddr, m: BigInt, sig): boolean {
    let c = sig[0];
    let z = sig[1];
    let Z = babyjub.mulPointEscalar(addr.H1, z);
    let P = babyjub.mulPointEscalar(addr.H3, c);
    let R = babyjub.addPoint(Z, P)
    let cp = poseidon([R[0], R[1], m]);
    return c == cp
}

