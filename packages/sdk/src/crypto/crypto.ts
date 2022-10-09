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
    let vk = Scalar.fromRprBE(vk_buf, 0, 32) % babyjub.subOrder;
    let sk = Scalar.fromRprBE(sk_buf, 0, 32) % babyjub.subOrder;
    let priv: FlaxPrivKey = {
        vk: vk,
        sk: sk,
    }
    return priv;
}

export function privToAddr(priv: FlaxPrivKey): FlaxAddr {
    let r_buf = randomBytes(Math.floor(256 / 8));
    let r = Scalar.fromRprBE(r_buf, 0, 32);
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

export function rerandAddr(addr: FlaxAddr): FlaxAddr {
    let r_buf = randomBytes(Math.floor(256 / 8));
    let r = Scalar.fromRprBE(r_buf, 0, 32);
    let H1 = babyjub.mulPointEscalar(addr.H1, r);
    let H2 = babyjub.mulPointEscalar(addr.H2, r);
    let H3 = babyjub.mulPointEscalar(addr.H3, r);
    return {
        H1: H1,
        H2: H2,
        H3: H3,
    };
}

const FlaxAddrPrefix = '0f';

export function addrToString(addr: FlaxAddr): String {
    let b1 = Buffer.from(babyjub.packPoint(addr.H1));
    let b2 = Buffer.from(babyjub.packPoint(addr.H2));
    let b3 = Buffer.from(babyjub.packPoint(addr.H3));
    console.log(b1.length);
    console.log(b2.length);
    console.log(b3.length);
    let b = Buffer.concat([b1, b2, b3]);
    return FlaxAddrPrefix + b.toString('base64');
}

export function parseAddr(str: String): FlaxAddr {
    let result = str.split(FlaxAddrPrefix);
    let base64str = str.slice(FlaxAddrPrefix.length);
    let b = Buffer.from(base64str, 'base64');
    let b1 = b.slice(0, 32);
    let b2 = b.slice(32, 64);
    let b3 = b.slice(64, 96);
    let H1 = babyjub.unpackPoint(b1);
    let H2 = babyjub.unpackPoint(b2);
    let H3 = babyjub.unpackPoint(b3);
    return {
        H1: H1,
        H2: H2,
        H3: H3,
    }
}

export function testOwn(priv: FlaxPrivKey, addr: FlaxAddr): boolean {
    let H2prime = babyjub.mulPointEscalar(addr.H1, priv.vk);
    return (addr.H2[0] === H2prime[0]) && (addr.H2[1] === H2prime[1]);
}

export function sign(priv: FlaxPrivKey, addr: FlaxAddr, m: BigInt) {
    // TODO: make this deterministic
    let r_buf = randomBytes(Math.floor(256 / 8));
    let r = Scalar.fromRprBE(r_buf, 0, 32);
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

