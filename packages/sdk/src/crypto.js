import { Scalar } from "ffjavascript";
import { buildBabyjub, buildPoseidon } from "circomlibjs"
import crypto from "crypto"

export default async function buildFlaxCrypto() {
    const babyJub = await buildBabyjub("bn128");
    const poseidon = await buildPoseidon();
    return new FlaxCrypto(babyJub, poseidon);
}

class FlaxCrypto {
    constructor(babyjub, poseidon) {
        this.babyjub = babyjub;
        this.poseidon = poseidon;
    }

    // Generate sk and vk
    genKey() {
        const sk_buf = crypto.randomBytes(Math.floor(256 / 8));
        const vk_buf = crypto.randomBytes(Math.floor(256 / 8));
        let sk = Scalar.fromRprLE(sk_buf, 0, 32);
        let vk = Scalar.fromRprLE(vk_buf, 0, 32);
        let H2 = this.babyjub.mulPointEscalar(this.babyjub.Base8, sk);
        let H3 = this.babyjub.mulPointEscalar(this.babyjub.Base8, vk);
        return [sk, vk, [this.babyjub.Base8, H2, H3]];
    }

    // Randomize an address
    randomizeAddr() {
    }

    // Sign a message m
    sign(sk, m) {
    }
}

