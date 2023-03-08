import { BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import {
  JoinSplitProcessed,
  RefundProcessed,
  SubtreeUpdate,
} from "../generated/Wallet/Wallet";
import {
  EncodedNote,
  EncodedOrEncryptedNote,
  EncryptedNote,
  SubtreeCommit,
  Nullifier,
} from "../generated/schema";

// assumes txIndex and logIndex are less than 2^32. in practice this is a pretty safe assumption (a block should never have billions of txs/log entries)
// assumption: txIndex and logIndex are less than 2^32.
// in practice this is a pretty safe assumption
// because a block should never have billions of txs or log entries
function getTotalLogIndex(event: ethereum.Event): BigInt {
  const blockNumber = event.block.number;
  const txIndex = event.transaction.index;
  const logIndex = event.logIndex;

  return blockNumber.leftShift(32).bitOr(txIndex).leftShift(32).bitOr(logIndex);
}

// Bytes(blockNumber << 96 | txIndex << 64 | logIndex << 32 || entityIndex)
// where `blockNumber`, `txIndex`, and `logIndex` uniquely identify the event
// and `entityIndex` is used to handle cases where a single event produces
// multiple entities (e.g. JoinSplit, which produces four of them)
function getId(totalLogIndex: BigInt, entityIndex: number): Bytes {
  const idNum = totalLogIndex
    .leftShift(32)
    .bitOr(BigInt.fromI32(entityIndex as i32));

  const without0x = idNum.toHexString().slice(2);
  // this leaves 160 bits for `blockNumber`. Plenty
  const padded = without0x.padStart(64, "0");

  return Bytes.fromHexString("0x" + padded);
}

export function handleJoinSplit(event: JoinSplitProcessed): void {
  const totalLogIndex = getTotalLogIndex(event);
  const joinSplit = event.params.joinSplit;

  // first old note's nullifier
  let id = getId(totalLogIndex, 0);
  const nullifierA = new Nullifier(id);
  nullifierA.nullifier = event.params.oldNoteANullifier;
  nullifierA.save();

  // second old note's nullfier
  id = getId(totalLogIndex, 1);
  const nullifierB = new Nullifier(id);
  nullifierB.nullifier = event.params.oldNoteBNullifier;
  nullifierB.save();

  // unpack first new note
  id = getId(totalLogIndex, 2);

  const encryptedNoteA = new EncryptedNote(id);

  const newNoteAEncrypted = joinSplit.newNoteAEncrypted;
  encryptedNoteA.ownerH1X = newNoteAEncrypted.owner.h1X;
  encryptedNoteA.ownerH1Y = newNoteAEncrypted.owner.h1Y;
  encryptedNoteA.ownerH2X = newNoteAEncrypted.owner.h2X;
  encryptedNoteA.ownerH2Y = newNoteAEncrypted.owner.h2Y;

  encryptedNoteA.encappedKey = newNoteAEncrypted.encappedKey;
  encryptedNoteA.encryptedNonce = newNoteAEncrypted.encryptedNonce;
  encryptedNoteA.encryptedValue = newNoteAEncrypted.encryptedValue;

  encryptedNoteA.encodedAssetAddr = joinSplit.encodedAsset.encodedAssetAddr;
  encryptedNoteA.encodedAssetId = joinSplit.encodedAsset.encodedAssetId;
  encryptedNoteA.commitment = joinSplit.newNoteACommitment;

  encryptedNoteA.save();

  const newNoteA = new EncodedOrEncryptedNote(id);
  newNoteA.merkleIndex = event.params.newNoteAIndex;
  newNoteA.encryptedNote = id;
  newNoteA.save();

  // unpack second new note
  id = getId(totalLogIndex, 3);

  const encryptedNoteB = new EncryptedNote(id);

  const newNoteBEncrypted = joinSplit.newNoteBEncrypted;
  encryptedNoteB.ownerH1X = newNoteBEncrypted.owner.h1X;
  encryptedNoteB.ownerH1Y = newNoteBEncrypted.owner.h1Y;
  encryptedNoteB.ownerH2X = newNoteBEncrypted.owner.h2X;
  encryptedNoteB.ownerH2Y = newNoteBEncrypted.owner.h2Y;

  encryptedNoteB.encappedKey = newNoteBEncrypted.encappedKey;
  encryptedNoteB.encryptedNonce = newNoteBEncrypted.encryptedNonce;
  encryptedNoteB.encryptedValue = newNoteBEncrypted.encryptedValue;

  encryptedNoteB.encodedAssetAddr = joinSplit.encodedAsset.encodedAssetAddr;
  encryptedNoteB.encodedAssetId = joinSplit.encodedAsset.encodedAssetId;
  encryptedNoteB.commitment = joinSplit.newNoteBCommitment;

  encryptedNoteB.save();

  const newNoteB = new EncodedOrEncryptedNote(id);
  newNoteB.merkleIndex = event.params.newNoteBIndex;
  newNoteB.encryptedNote = id;
  newNoteB.save();
}

export function handleRefund(event: RefundProcessed): void {
  const totalLogIndex = getTotalLogIndex(event);

  const id = getId(totalLogIndex, 0);
  const newNote = new EncodedOrEncryptedNote(id);
  const encodedNote = new EncodedNote(id);

  const refundAddr = event.params.refundAddr;

  encodedNote.ownerH1X = refundAddr.h1X;
  encodedNote.ownerH1Y = refundAddr.h1Y;
  encodedNote.ownerH2X = refundAddr.h2X;
  encodedNote.ownerH2Y = refundAddr.h2Y;
  encodedNote.nonce = event.params.nonce;
  encodedNote.encodedAssetAddr = event.params.encodedAssetAddr;
  encodedNote.encodedAssetId = event.params.encodedAssetId;
  encodedNote.value = event.params.value;
  encodedNote.save();

  newNote.merkleIndex = event.params.merkleIndex;
  newNote.note = id;
  newNote.save();
}

export function handleSubtreeUpdate(event: SubtreeUpdate): void {
  const totalLogIndex = getTotalLogIndex(event);

  const id = getId(totalLogIndex, 0);
  const commit = new SubtreeCommit(id);

  commit.newRoot = event.params.newRoot;
  commit.subtreeIndex = event.params.subtreeIndex;
  commit.save();
}
