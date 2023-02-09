import { babyjub, poseidon } from "circomlibjs";
import randomBytes from "randombytes";
import { Scalar } from "ffjavascript";
import { Note, IncludedNote, NoteTrait } from "./note";
import {
  StealthAddress,
  StealthAddressTrait,
  CanonAddress,
} from "../crypto/address";
import { NocturnePrivKey } from "../crypto/privkey";
import { egcd, encodePoint, decodePoint, mod_p } from "../crypto/utils";
import { EncryptedNote, PreProofJoinSplit, PreProofOperation, PreSignJoinSplit, PreSignOperation } from "../commonTypes";
import { Asset } from "./asset";
import { computeOperationDigest } from "../contract";
import { JoinSplitInputs } from "../proof";

export interface NocturneSignature {
  c: bigint;
  z: bigint;
}

export class NocturneSigner {
  privkey: NocturnePrivKey;
  address: StealthAddress;
  canonAddress: CanonAddress;

  constructor(privkey: NocturnePrivKey) {
    const address = privkey.toAddress();

    this.privkey = privkey;
    this.canonAddress = privkey.toCanonAddress();
    this.address = address;
  }

  sign(m: bigint): NocturneSignature {
    // TODO: make this deterministic
    const r_buf = randomBytes(Math.floor(256 / 8));
    const r = Scalar.fromRprBE(r_buf, 0, 32) % babyjub.subOrder;
    const R = babyjub.mulPointEscalar(babyjub.Base8, r);
    const c = poseidon([R[0], R[1], m]);

    // eslint-disable-next-line
    let z = (r - (this.privkey.sk as any) * c) % babyjub.subOrder;
    if (z < 0) {
      z += babyjub.subOrder;
    }

    return {
      c: BigInt(c),
      z: BigInt(z),
    };
  }

  static verify(
    pk: [bigint, bigint],
    m: bigint,
    sig: NocturneSignature
  ): boolean {
    const c = sig.c;
    const z = sig.z;
    const Z = babyjub.mulPointEscalar(babyjub.Base8, z);
    const P = babyjub.mulPointEscalar(pk, c);
    const R = babyjub.addPoint(Z, P);
    const cp = poseidon([R[0], R[1], m]);
    return c == cp;
  }

  createNullifier(note: Note): bigint {
    if (!this.isOwnAddress(note.owner)) {
      throw Error("Attempted to create nullifier for note you do not own");
    }

    return BigInt(poseidon([NoteTrait.toCommitment(note), this.privkey.vk]));
  }

  generateNewNonce(oldNullifier: bigint): bigint {
    return poseidon([this.privkey.vk, oldNullifier]);
  }

  /**
   * Obtain the note from a note transmission. Assumes that the signer owns the
   * note transmission.
   *
   * @param encryptedNote
   * @param asset, id, merkleIndex additional params from the joinsplit event
   * @return note
   */
  getNoteFromEncryptedNote(
    encryptedNote: EncryptedNote,
    merkleIndex: number,
    asset: Asset
  ): IncludedNote {
    if (!this.isOwnAddress(encryptedNote.owner)) {
      throw Error("Cannot decrypt a note that is not owned by signer.");
    }
    let [vkInv, ,] = egcd(this.privkey.vk, babyjub.subOrder);
    if (vkInv < babyjub.subOrder) {
      vkInv += babyjub.subOrder;
    }
    const eR = decodePoint(encryptedNote.encappedKey);
    const R = babyjub.mulPointEscalar(eR, vkInv);
    const nonce = mod_p(
      encryptedNote.encryptedNonce - BigInt(poseidon([encodePoint(R)]))
    );
    const value = mod_p(
      encryptedNote.encryptedValue - BigInt(poseidon([encodePoint(R) + 1n]))
    );
    return {
      owner: this.privkey.toCanonAddressStruct(),
      nonce,
      asset,
      value,
      merkleIndex,
    };
  }

  isOwnAddress(addr: StealthAddress): boolean {
    const points = StealthAddressTrait.toPoints(addr);
    const H2prime = babyjub.mulPointEscalar(points.h1, this.privkey.vk);
    return points.h2[0] === H2prime[0] && points.h2[1] === H2prime[1];
  }

  signOperation(op: PreSignOperation): PreProofOperation {
    const opDigest = computeOperationDigest(op);
    const opSig = this.sign(opDigest);
    const pk = this.privkey.spendPk();

    const joinSplits: PreProofJoinSplit[] = op.joinSplits.map(joinSplit => makePreProofJoinSplit(joinSplit, opDigest, opSig, this.privkey.vk, pk));

    const { actions, refundAddr, encodedRefundAssets, verificationGasLimit, executionGasLimit, gasPrice, maxNumRefunds } = op;

    return {
      joinSplits,
      refundAddr,
      encodedRefundAssets,
      actions,
      verificationGasLimit,
      executionGasLimit,
      gasPrice,
      maxNumRefunds,
    };
  }
}

function makePreProofJoinSplit(
    preSignJoinSplit: PreSignJoinSplit,
    opDigest: bigint,
    opSig: NocturneSignature,
    vk: bigint,
    spendPk: [bigint, bigint],
): PreProofJoinSplit {
    const {
      merkleProofA,
      merkleProofB,
      oldNoteA,
      oldNoteB,
      newNoteA,
      newNoteB,
      ...baseJoinSplit
    } = preSignJoinSplit;

    const { c, z } = opSig;

    const proofInputs: JoinSplitInputs = {
      vk,
      spendPk,
      c,
      z,
      merkleProofA,
      merkleProofB,
      operationDigest: opDigest,
      oldNoteA: NoteTrait.encode(oldNoteA),
      oldNoteB: NoteTrait.encode(oldNoteB),
      newNoteA: NoteTrait.encode(newNoteA),
      newNoteB: NoteTrait.encode(newNoteB),
    };

    return {
      opDigest,
      proofInputs,
      ...baseJoinSplit,
    };
}
