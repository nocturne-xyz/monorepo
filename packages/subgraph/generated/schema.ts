// THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY.

import {
  TypedMap,
  Entity,
  Value,
  ValueKind,
  store,
  Bytes,
  BigInt,
  BigDecimal
} from "@graphprotocol/graph-ts";

export class EncodedOrEncryptedNote extends Entity {
  constructor(id: Bytes) {
    super();
    this.set("id", Value.fromBytes(id));
  }

  save(): void {
    let id = this.get("id");
    assert(
      id != null,
      "Cannot save EncodedOrEncryptedNote entity without an ID"
    );
    if (id) {
      assert(
        id.kind == ValueKind.BYTES,
        `Entities of type EncodedOrEncryptedNote must have an ID of type Bytes but the id '${id.displayData()}' is of type ${id.displayKind()}`
      );
      store.set("EncodedOrEncryptedNote", id.toBytes().toHexString(), this);
    }
  }

  static load(id: Bytes): EncodedOrEncryptedNote | null {
    return changetype<EncodedOrEncryptedNote | null>(
      store.get("EncodedOrEncryptedNote", id.toHexString())
    );
  }

  get id(): Bytes {
    let value = this.get("id");
    return value!.toBytes();
  }

  set id(value: Bytes) {
    this.set("id", Value.fromBytes(value));
  }

  get merkleIndex(): BigInt {
    let value = this.get("merkleIndex");
    return value!.toBigInt();
  }

  set merkleIndex(value: BigInt) {
    this.set("merkleIndex", Value.fromBigInt(value));
  }

  get note(): Bytes | null {
    let value = this.get("note");
    if (!value || value.kind == ValueKind.NULL) {
      return null;
    } else {
      return value.toBytes();
    }
  }

  set note(value: Bytes | null) {
    if (!value) {
      this.unset("note");
    } else {
      this.set("note", Value.fromBytes(<Bytes>value));
    }
  }

  get encryptedNote(): Bytes | null {
    let value = this.get("encryptedNote");
    if (!value || value.kind == ValueKind.NULL) {
      return null;
    } else {
      return value.toBytes();
    }
  }

  set encryptedNote(value: Bytes | null) {
    if (!value) {
      this.unset("encryptedNote");
    } else {
      this.set("encryptedNote", Value.fromBytes(<Bytes>value));
    }
  }
}

export class EncodedNote extends Entity {
  constructor(id: Bytes) {
    super();
    this.set("id", Value.fromBytes(id));
  }

  save(): void {
    let id = this.get("id");
    assert(id != null, "Cannot save EncodedNote entity without an ID");
    if (id) {
      assert(
        id.kind == ValueKind.BYTES,
        `Entities of type EncodedNote must have an ID of type Bytes but the id '${id.displayData()}' is of type ${id.displayKind()}`
      );
      store.set("EncodedNote", id.toBytes().toHexString(), this);
    }
  }

  static load(id: Bytes): EncodedNote | null {
    return changetype<EncodedNote | null>(
      store.get("EncodedNote", id.toHexString())
    );
  }

  get id(): Bytes {
    let value = this.get("id");
    return value!.toBytes();
  }

  set id(value: Bytes) {
    this.set("id", Value.fromBytes(value));
  }

  get ownerH1X(): BigInt {
    let value = this.get("ownerH1X");
    return value!.toBigInt();
  }

  set ownerH1X(value: BigInt) {
    this.set("ownerH1X", Value.fromBigInt(value));
  }

  get ownerH1Y(): BigInt {
    let value = this.get("ownerH1Y");
    return value!.toBigInt();
  }

  set ownerH1Y(value: BigInt) {
    this.set("ownerH1Y", Value.fromBigInt(value));
  }

  get ownerH2X(): BigInt {
    let value = this.get("ownerH2X");
    return value!.toBigInt();
  }

  set ownerH2X(value: BigInt) {
    this.set("ownerH2X", Value.fromBigInt(value));
  }

  get ownerH2Y(): BigInt {
    let value = this.get("ownerH2Y");
    return value!.toBigInt();
  }

  set ownerH2Y(value: BigInt) {
    this.set("ownerH2Y", Value.fromBigInt(value));
  }

  get nonce(): BigInt {
    let value = this.get("nonce");
    return value!.toBigInt();
  }

  set nonce(value: BigInt) {
    this.set("nonce", Value.fromBigInt(value));
  }

  get encodedAssetAddr(): BigInt {
    let value = this.get("encodedAssetAddr");
    return value!.toBigInt();
  }

  set encodedAssetAddr(value: BigInt) {
    this.set("encodedAssetAddr", Value.fromBigInt(value));
  }

  get encodedAssetId(): BigInt {
    let value = this.get("encodedAssetId");
    return value!.toBigInt();
  }

  set encodedAssetId(value: BigInt) {
    this.set("encodedAssetId", Value.fromBigInt(value));
  }

  get value(): BigInt {
    let value = this.get("value");
    return value!.toBigInt();
  }

  set value(value: BigInt) {
    this.set("value", Value.fromBigInt(value));
  }
}

export class EncryptedNote extends Entity {
  constructor(id: Bytes) {
    super();
    this.set("id", Value.fromBytes(id));
  }

  save(): void {
    let id = this.get("id");
    assert(id != null, "Cannot save EncryptedNote entity without an ID");
    if (id) {
      assert(
        id.kind == ValueKind.BYTES,
        `Entities of type EncryptedNote must have an ID of type Bytes but the id '${id.displayData()}' is of type ${id.displayKind()}`
      );
      store.set("EncryptedNote", id.toBytes().toHexString(), this);
    }
  }

  static load(id: Bytes): EncryptedNote | null {
    return changetype<EncryptedNote | null>(
      store.get("EncryptedNote", id.toHexString())
    );
  }

  get id(): Bytes {
    let value = this.get("id");
    return value!.toBytes();
  }

  set id(value: Bytes) {
    this.set("id", Value.fromBytes(value));
  }

  get ownerH1X(): BigInt {
    let value = this.get("ownerH1X");
    return value!.toBigInt();
  }

  set ownerH1X(value: BigInt) {
    this.set("ownerH1X", Value.fromBigInt(value));
  }

  get ownerH1Y(): BigInt {
    let value = this.get("ownerH1Y");
    return value!.toBigInt();
  }

  set ownerH1Y(value: BigInt) {
    this.set("ownerH1Y", Value.fromBigInt(value));
  }

  get ownerH2X(): BigInt {
    let value = this.get("ownerH2X");
    return value!.toBigInt();
  }

  set ownerH2X(value: BigInt) {
    this.set("ownerH2X", Value.fromBigInt(value));
  }

  get ownerH2Y(): BigInt {
    let value = this.get("ownerH2Y");
    return value!.toBigInt();
  }

  set ownerH2Y(value: BigInt) {
    this.set("ownerH2Y", Value.fromBigInt(value));
  }

  get encappedKey(): BigInt {
    let value = this.get("encappedKey");
    return value!.toBigInt();
  }

  set encappedKey(value: BigInt) {
    this.set("encappedKey", Value.fromBigInt(value));
  }

  get encryptedNonce(): BigInt {
    let value = this.get("encryptedNonce");
    return value!.toBigInt();
  }

  set encryptedNonce(value: BigInt) {
    this.set("encryptedNonce", Value.fromBigInt(value));
  }

  get encryptedValue(): BigInt {
    let value = this.get("encryptedValue");
    return value!.toBigInt();
  }

  set encryptedValue(value: BigInt) {
    this.set("encryptedValue", Value.fromBigInt(value));
  }

  get encodedAssetAddr(): BigInt {
    let value = this.get("encodedAssetAddr");
    return value!.toBigInt();
  }

  set encodedAssetAddr(value: BigInt) {
    this.set("encodedAssetAddr", Value.fromBigInt(value));
  }

  get encodedAssetId(): BigInt {
    let value = this.get("encodedAssetId");
    return value!.toBigInt();
  }

  set encodedAssetId(value: BigInt) {
    this.set("encodedAssetId", Value.fromBigInt(value));
  }

  get commitment(): BigInt {
    let value = this.get("commitment");
    return value!.toBigInt();
  }

  set commitment(value: BigInt) {
    this.set("commitment", Value.fromBigInt(value));
  }
}

export class Nullifier extends Entity {
  constructor(id: Bytes) {
    super();
    this.set("id", Value.fromBytes(id));
  }

  save(): void {
    let id = this.get("id");
    assert(id != null, "Cannot save Nullifier entity without an ID");
    if (id) {
      assert(
        id.kind == ValueKind.BYTES,
        `Entities of type Nullifier must have an ID of type Bytes but the id '${id.displayData()}' is of type ${id.displayKind()}`
      );
      store.set("Nullifier", id.toBytes().toHexString(), this);
    }
  }

  static load(id: Bytes): Nullifier | null {
    return changetype<Nullifier | null>(
      store.get("Nullifier", id.toHexString())
    );
  }

  get id(): Bytes {
    let value = this.get("id");
    return value!.toBytes();
  }

  set id(value: Bytes) {
    this.set("id", Value.fromBytes(value));
  }

  get nullifier(): BigInt {
    let value = this.get("nullifier");
    return value!.toBigInt();
  }

  set nullifier(value: BigInt) {
    this.set("nullifier", Value.fromBigInt(value));
  }
}

export class SubtreeCommit extends Entity {
  constructor(id: Bytes) {
    super();
    this.set("id", Value.fromBytes(id));
  }

  save(): void {
    let id = this.get("id");
    assert(id != null, "Cannot save SubtreeCommit entity without an ID");
    if (id) {
      assert(
        id.kind == ValueKind.BYTES,
        `Entities of type SubtreeCommit must have an ID of type Bytes but the id '${id.displayData()}' is of type ${id.displayKind()}`
      );
      store.set("SubtreeCommit", id.toBytes().toHexString(), this);
    }
  }

  static load(id: Bytes): SubtreeCommit | null {
    return changetype<SubtreeCommit | null>(
      store.get("SubtreeCommit", id.toHexString())
    );
  }

  get id(): Bytes {
    let value = this.get("id");
    return value!.toBytes();
  }

  set id(value: Bytes) {
    this.set("id", Value.fromBytes(value));
  }

  get newRoot(): BigInt {
    let value = this.get("newRoot");
    return value!.toBigInt();
  }

  set newRoot(value: BigInt) {
    this.set("newRoot", Value.fromBigInt(value));
  }

  get subtreeIndex(): BigInt {
    let value = this.get("subtreeIndex");
    return value!.toBigInt();
  }

  set subtreeIndex(value: BigInt) {
    this.set("subtreeIndex", Value.fromBigInt(value));
  }
}
