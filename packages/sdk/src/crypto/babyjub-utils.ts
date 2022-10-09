// @flow

import { babyjub, eddsa, poseidon } from "circomlibjs";
import * as crypto from "crypto";
import { utils, ZqField, Scalar } from "ffjavascript";
const createBlakeHash = require("blake-hash");

// TODO: rewrite Babyjub library to have constant time crypto

export interface FlaxPrivKey {
    vk: BigInt; // a number between 0 and babyjub.subOrder - 1
    sk: BigInt; // a number between 0 and babyjub.subOrder - 1
}

export interface FlaxAddr {
    H1: [BigInt, BigInt];
    H2: [BigInt, BigInt];
    H3: [BigInt, BigInt];
}

export function genPriv(): FlaxPrivKey {
    // TODO make vk and sk acutally uniformly distributed
    let vk_buf = crypto.randomBytes(Math.floor(256 / 8));
    let sk_buf = crypto.randomBytes(Math.floor(256 / 8));
    let vk = Scalar.fromRprLE(vk_buf, 0, 32) % babyjub.subOrder;
    let sk = Scalar.fromRprLE(sk_buf, 0, 32) % babyjub.subOrder;
    let priv: FlaxPrivKey = {
        vk: vk,
        sk: sk,
    }
    return priv;
}

export function privToAddr(priv: FlaxPrivKey): FlaxAddr {
    let r_buf = crypto.randomBytes(Math.floor(256 / 8));
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

export function sign(priv: FlaxPrivKey, addr: FlaxAddr, m: BigInt): boolean {
    // TODO: make this deterministic
    let r_buf = crypto.randomBytes(Math.floor(256 / 8));
    let r = Scalar.fromRprLE(r_buf, 0, 32);
    let R = babyjub.mulPointEscalar(addr.H1, r);
    let c = poseidon([addr.H1[0], addr.H3[0], R[0], R[1], m]);
    console.log([addr.H1[0], addr.H3[0], R[0], R[1], m]);
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
    let cp = poseidon([addr.H1[0], addr.H3[0], R[0], R[1], m]);
    console.log([addr.H1[0], addr.H3[0], R[0], R[1], m]);
    return c == cp
}

// /**
//  * Get compressed point given a public key compsed by coordinate X and Y
//  * @param {Buffer} pubKeyX - Coordinate X of public key
//  * @param {Buffer} pubKeyY - Coordinate Y of public key
//  * @returns {Buffer} - Public key compressed
//  */
// export function compressPoint(pubKeyX: Buffer, pubKeyY: Buffer): Buffer {
//   const pubKeyXBigInt = bufferToBigIntBE(pubKeyX);
//   if (pubKeyXBigInt.greater(babyjub.p.shr(1))) {
//     pubKeyY[0] |= 0x80;
//   }
//   return pubKeyY;
// }

// /**
//  * Get number of bits given a big integer
//  * @param {bigInt} number - big integer
//  * @returns {number} - number of bits necessary to represent big integer input
//  */
// export function bigIntbits(number: BigInteger): number {
//   let numBits = 0;
//   while (!number.isZero()) {
//     number = number.shiftRight(1);
//     numBits += 1;
//   }
//   return numBits;
// }

// /**
//  * Generates a random private key in a subgroup specified by the babyjub field
//  * @returns {string} - Hexadecimal string
//  */
// export function genPriv(): string {
//   const randBytes = crypto.randomBytes(Math.floor(256 / 8));
//   const randHex = bytesToHex(randBytes);
//   return randHex;
// }

// /**
//  * Retrieve uniform scalar in babyjub curve subgroup
//  * @param {Buffer} privKey - Private key
//  * @returns {bigInt} scalar in subgroup babyjub order
//  */
// export function privToScalar(privKey: Buffer): BigInteger {
//   const h1 = createBlakeHash("blake512").update(privKey).digest();
//   const sBuff = eddsa.pruneBuffer(h1.slice(0, 32));
//   const scalar = leBuffToInt(sBuff).shiftRight(3);
//   if (scalar >= babyjub.p) {
//     throw new Error("scalar generated larger than subgroup");
//   }
//   return scalar;
// }

// /**
//  * Retrieve public key from private key in a babyjub curve
//  * @param {Buffer} privKey - Private key
//  * @param {bool} compress - Flag to indicate if output is public key compresed or not
//  * @returns {Buffer} New public key generated
//  */
// export function privToPub(privKey: Buffer, compress: boolean): Buffer {
//   if (privKey.length !== 32) {
//     throw new Error(
//       `Input Error: Buffer has ${privKey.length} bytes. It should be 32 bytes`
//     );
//   }
//   const scalar = privToScalar(privKey);
//   const pubKey = babyjub.mulPointEscalar(babyjub.Base8, scalar);

//   console.log("PUBKEY: ", pubKey);

//   const pubKeyX = bigIntToBufferBE(bigInt(pubKey[0]));
//   const pubKeyY = bigIntToBufferBE(bigInt(pubKey[1]));
//   if (!babyjub.inSubgroup(pubKey)) {
//     throw new Error("Point generated not in babyjub subgroup");
//   }
//   if (!compress) {
//     return Buffer.concat([pubKeyX, pubKeyY]);
//   }
//   return compressPoint(pubKeyX, pubKeyY);
// }
