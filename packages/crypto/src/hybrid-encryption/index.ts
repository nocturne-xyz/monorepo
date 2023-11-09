// a Nocturne-specific hybrid encryption scheme that requires the sender to prove knowledge of the decapsulated secret
// see [TODO] for more information

import { sha256 } from "@noble/hashes/sha256";
import { expand, extract } from "@noble/hashes/hkdf";
import { BabyJubJub, AffinePoint } from "../BabyJubJub";
import {
  ChaCha20Poly1305,
  KEY_LENGTH,
  NONCE_LENGTH,
} from "@stablelib/chacha20poly1305";
import { HPKEKDF, deriveBaseNonce } from "./nonceDerivation";
import { bytesToNumberLE } from "@noble/curves/abstract/utils";
import randomBytes from "randombytes";

export interface HybridCiphertext {
  ciphertextBytes: Uint8Array;
  encapsulatedSecretBytes: Uint8Array;
}

export interface SerializedHybridCiphertext {
  ciphertextBytes: number[];
  encapsulatedSecretBytes: number[];
}

export function serializeHybridCiphertext(
  ciphertext: HybridCiphertext
): SerializedHybridCiphertext {
  return {
    ciphertextBytes: Array.from(ciphertext.ciphertextBytes),
    encapsulatedSecretBytes: Array.from(ciphertext.encapsulatedSecretBytes),
  };
}

export function deserializeHybridCiphertext(
  ciphertext: SerializedHybridCiphertext
): HybridCiphertext {
  return {
    ciphertextBytes: new Uint8Array(ciphertext.ciphertextBytes),
    encapsulatedSecretBytes: new Uint8Array(ciphertext.encapsulatedSecretBytes),
  };
}

export const HKDF_SHA256: HPKEKDF = {
  extract: (ikm: Uint8Array, salt?: Uint8Array) => extract(sha256, ikm, salt),
  expand: (prk: Uint8Array, outputLen: number, info?: Uint8Array) =>
    expand(sha256, prk, info, outputLen),
};

export class BabyJubJubHybridCipher {
  protected ephemeralSecretEntropyNumBytes: number;

  // curve is the elliptic curve to use for encryption
  // ephemeralSecretEntropyNumBytes is the number of bytes of entropy to use for the ephemeral secret key.
  // The ephemeral secret is derived by interpreting this array as a little-endian number and reducing it modulo the scalar field order,
  // so the `ephemeralSecretEntropyNumBytes` should be set to a significantly larger value than the scalar field order's byte length
  // to ensure that the resulting secret key has a close to uniform distribution.
  constructor(ephemeralSecretEntropyNumBytes: number) {
    this.ephemeralSecretEntropyNumBytes = ephemeralSecretEntropyNumBytes;
  }

  // encrypts a message to a given receiver public key rB, where r is the receiver's secret key and B is the curve's base point
  public encrypt(
    msg: Uint8Array,
    receiverPubkey: AffinePoint<bigint>,
    // for test purposes only
    __ephemeralSecretEntropy?: Uint8Array
  ): HybridCiphertext {
    // sample ephemeral secret
    // sample ephemeral secret
    let ephemeralSecretEntropy: Uint8Array;
    if (__ephemeralSecretEntropy) {
      ephemeralSecretEntropy = __ephemeralSecretEntropy;
    } else {
      ephemeralSecretEntropy = randomBytes(this.ephemeralSecretEntropyNumBytes);
    }
    const ephemeralSecret = BabyJubJub.ScalarField.create(
      bytesToNumberLE(ephemeralSecretEntropy)
    );

    // construct plaintext: ephemeralSecret || msg
    const ephemeralSecretBytes =
      BabyJubJub.ScalarField.toBytes(ephemeralSecret);
    const plaintext = new Uint8Array(ephemeralSecretBytes.length + msg.length);
    plaintext.set(ephemeralSecretBytes);
    plaintext.set(msg, ephemeralSecretBytes.length);

    // encapsulate ephemeral secret
    const encapsulatedSecret =
      BabyJubJub.BasePointExtended.multiply(ephemeralSecret);

    // compute shared secret
    const sharedSecret =
      BabyJubJub.ExtendedPoint.fromAffine(receiverPubkey).multiply(
        ephemeralSecret
      );

    // derive IKM from shared secret and encapsulated secret
    const encapsulatedSecretBytes = BabyJubJub.toBytes(encapsulatedSecret);
    const sharedSecretBytes = BabyJubJub.toBytes(sharedSecret);
    const ikm = new Uint8Array(
      encapsulatedSecretBytes.length + sharedSecretBytes.length
    );
    ikm.set(encapsulatedSecretBytes);
    ikm.set(sharedSecretBytes, encapsulatedSecretBytes.length);

    // derive ephemeral encryption key from IKM
    const prk = HKDF_SHA256.extract(ikm);
    const ephemeralKey = HKDF_SHA256.expand(prk, KEY_LENGTH);

    // encrypt
    const cipher = new ChaCha20Poly1305(ephemeralKey);
    const nonce = deriveBaseNonce(HKDF_SHA256, sharedSecretBytes, NONCE_LENGTH);
    const ciphertextBytes = cipher.seal(nonce, plaintext);
    cipher.clean();

    return {
      ciphertextBytes,
      encapsulatedSecretBytes,
    };
  }

  decrypt(
    ciphertext: HybridCiphertext,
    receiverPrivateKey: bigint
  ): Uint8Array | null {
    // deserialize stuff
    const { ciphertextBytes, encapsulatedSecretBytes } = ciphertext;

    let returnNull = false;
    let encapsulatedSecret = BabyJubJub.fromBytesUnsafe(
      encapsulatedSecretBytes
    );
    if (encapsulatedSecret === null) {
      encapsulatedSecret = BabyJubJub.BasePointExtended;
      returnNull = true;
    }

    // compute shared secret
    const sharedSecret = encapsulatedSecret.multiply(receiverPrivateKey);

    // derive IKM from shared secret and encapsulated secret
    const sharedSecretBytes = BabyJubJub.toBytes(sharedSecret);
    const ikm = new Uint8Array(
      encapsulatedSecretBytes.length + sharedSecretBytes.length
    );
    ikm.set(encapsulatedSecretBytes);
    ikm.set(sharedSecretBytes, encapsulatedSecretBytes.length);

    // derive ephemeral encryption key from IKM
    const prk = HKDF_SHA256.extract(ikm);
    const ephemeralKey = HKDF_SHA256.expand(prk, KEY_LENGTH);

    // decrypt
    const cipher = new ChaCha20Poly1305(ephemeralKey);
    const nonce = deriveBaseNonce(HKDF_SHA256, sharedSecretBytes, NONCE_LENGTH);
    let plaintext = cipher.open(nonce, ciphertextBytes);
    if (plaintext === null) {
      plaintext = ciphertextBytes;
      returnNull = true;
    }
    cipher.clean();

    // extract ephemeral secret and msg from plaintext
    const ephemeralSecretBytes = plaintext.slice(
      0,
      BabyJubJub.ScalarField.BYTES
    );
    const msg = plaintext.slice(BabyJubJub.ScalarField.BYTES);

    let ephemeralSecret =
      BabyJubJub.ScalarField.fromBytesUnsafe(ephemeralSecretBytes);
    if (ephemeralSecret === null) {
      ephemeralSecret = BabyJubJub.ScalarField.ORDER - 1n;
      returnNull = true;
    }

    // check ephemeralSecret against encapsulated secret
    const encapsulatedSecretCheck =
      BabyJubJub.BasePointExtended.multiply(ephemeralSecret);
    if (!encapsulatedSecretCheck.equals(encapsulatedSecret) || returnNull) {
      return null;
    }

    return msg;
  }
}
