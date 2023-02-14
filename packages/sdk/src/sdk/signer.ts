import { BabyJubJub, poseidonBN } from "@nocturne-xyz/circuit-utils";
import randomBytes from "randombytes";
import { Note, IncludedNote, NoteTrait } from "./note";
import {
  StealthAddress,
  StealthAddressTrait,
  CanonAddress,
} from "../crypto/address";
import { NocturnePrivKey, SpendPk } from "../crypto/privkey";
import { encodePoint, decodePoint } from "../crypto/utils";
import {
  EncryptedNote,
  SignedJoinSplit,
  SignedOperation,
  PreProofJoinSplit,
  PreSignOperation,
} from "../commonTypes";
import { Asset } from "./asset";
import { computeOperationDigest } from "../contract";
import { JoinSplitInputs } from "../proof";

const F = BabyJubJub.BaseField;
const Fr = BabyJubJub.ScalarField;

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
    const r = Fr.fromBytes(r_buf);
    const R = BabyJubJub.scalarMul(BabyJubJub.BasePoint, r);
    const c = poseidonBN([R.x, R.y, m]);

    // eslint-disable-next-line
    let z = Fr.reduce(r - (this.privkey.sk as any) * c);
    if (z < 0) {
      z += BabyJubJub.PrimeSubgroupOrder;
    }

    return {
      c,
      z
    };
  }

  static verify(
    pk: SpendPk,
    m: bigint,
    sig: NocturneSignature
  ): boolean {
    const c = sig.c;
    const z = sig.z;
    const Z = BabyJubJub.scalarMul(BabyJubJub.BasePoint, z);
    const P = BabyJubJub.scalarMul(pk, c);
    const R = BabyJubJub.add(Z, P);
    const cp = poseidonBN([R.x, R.y, m]);
    return c == cp;
  }

  createNullifier(note: Note): bigint {
    if (!this.isOwnAddress(note.owner)) {
      throw Error("Attempted to create nullifier for note you do not own");
    }

    return BigInt(poseidonBN([NoteTrait.toCommitment(note), this.privkey.vk]));
  }

  generateNewNonce(oldNullifier: bigint): bigint {
    return poseidonBN([this.privkey.vk, oldNullifier]);
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
    let vkInv = Fr.inv(this.privkey.vk);
    if (vkInv < BabyJubJub.PrimeSubgroupOrder) {
      vkInv += BabyJubJub.PrimeSubgroupOrder;
    }

    const eR = decodePoint(encryptedNote.encappedKey);
    const R = BabyJubJub.scalarMul(eR, vkInv);
    const nonce = F.sub(
      F.reduce(encryptedNote.encryptedNonce),
      F.reduce(
        poseidonBN([encodePoint(R)])
      )
    );

    const value = F.sub(
      F.reduce(encryptedNote.encryptedValue),
      F.reduce(poseidonBN([F.reduce(encodePoint(R) + 1n)]))
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
    const h2Prime = BabyJubJub.scalarMul(points.h1, this.privkey.vk);

    return BabyJubJub.eq(points.h2, h2Prime);
  }

  signOperation(op: PreSignOperation): SignedOperation {
    const opDigest = computeOperationDigest(op);
    const opSig = this.sign(opDigest);
    const pk = this.privkey.spendPk();

    const joinSplits: SignedJoinSplit[] = op.joinSplits.map((joinSplit) =>
      makeSignedJoinSplit(joinSplit, opDigest, opSig, this.privkey.vk, pk)
    );

    const {
      actions,
      refundAddr,
      encodedRefundAssets,
      verificationGasLimit,
      executionGasLimit,
      gasPrice,
      maxNumRefunds,
    } = op;

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

function makeSignedJoinSplit(
  preProofJoinSplit: PreProofJoinSplit,
  opDigest: bigint,
  opSig: NocturneSignature,
  vk: bigint,
  spendPk: SpendPk,
): SignedJoinSplit {
  const {
    merkleProofA,
    merkleProofB,
    oldNoteA,
    oldNoteB,
    newNoteA,
    newNoteB,
    ...baseJoinSplit
  } = preProofJoinSplit;

  const { c, z } = opSig;

  const proofInputs: JoinSplitInputs = {
    vk,
    spendPk: [spendPk.x, spendPk.y],
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
