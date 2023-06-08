import {
  FilledBatchWithZeros,
  JoinSplitProcessed,
  RefundProcessed,
  SubtreeUpdate,
} from "../generated/Handler/Handler";
import {
  EncodedNote,
  EncodedOrEncryptedNote,
  EncryptedNote,
  SubtreeCommit,
  Nullifier,
  FilledBatchWithZerosEvent,
} from "../generated/schema";
import {
  getTotalLogIndex,
  getTotalEntityIndex,
  toPaddedHexString,
} from "./utils";

export function handleJoinSplit(event: JoinSplitProcessed): void {
  const totalLogIndex = getTotalLogIndex(event);

  // first old note's nullifier
  let idx = getTotalEntityIndex(totalLogIndex, 0);
  const nullifierA = new Nullifier(toPaddedHexString(idx));
  nullifierA.nullifier = event.params.oldNoteANullifier;
  nullifierA.save();

  // second old note's nullfier
  idx = getTotalEntityIndex(totalLogIndex, 1);
  const nullifierB = new Nullifier(toPaddedHexString(idx));
  nullifierB.nullifier = event.params.oldNoteBNullifier;
  nullifierB.save();

  // unpack first new note
  idx = getTotalEntityIndex(totalLogIndex, 2);
  let id = toPaddedHexString(idx);

  const encryptedNoteA = new EncryptedNote(id);
  const newNoteAEncrypted = event.params.newNoteAEncrypted;
  encryptedNoteA.ownerH1 = newNoteAEncrypted.owner.h1;
  encryptedNoteA.ownerH2 = newNoteAEncrypted.owner.h2;

  encryptedNoteA.encappedKey = newNoteAEncrypted.encappedKey;
  encryptedNoteA.encryptedNonce = newNoteAEncrypted.encryptedNonce;
  encryptedNoteA.encryptedValue = newNoteAEncrypted.encryptedValue;

  encryptedNoteA.encodedAssetAddr = event.params.encodedAsset.encodedAssetAddr;
  encryptedNoteA.encodedAssetId = event.params.encodedAsset.encodedAssetId;
  encryptedNoteA.commitment = event.params.newNoteACommitment;

  encryptedNoteA.save();

  const newNoteA = new EncodedOrEncryptedNote(id);
  newNoteA.merkleIndex = event.params.newNoteAIndex;
  newNoteA.encryptedNote = id;
  newNoteA.save();

  // unpack second new note

  idx = getTotalEntityIndex(totalLogIndex, 3);
  id = toPaddedHexString(idx);
  const encryptedNoteB = new EncryptedNote(id);

  const newNoteBEncrypted = event.params.newNoteBEncrypted;
  encryptedNoteB.ownerH1 = newNoteBEncrypted.owner.h1;
  encryptedNoteB.ownerH2 = newNoteBEncrypted.owner.h2;

  encryptedNoteB.encappedKey = newNoteBEncrypted.encappedKey;
  encryptedNoteB.encryptedNonce = newNoteBEncrypted.encryptedNonce;
  encryptedNoteB.encryptedValue = newNoteBEncrypted.encryptedValue;

  encryptedNoteB.encodedAssetAddr = event.params.encodedAsset.encodedAssetAddr;
  encryptedNoteB.encodedAssetId = event.params.encodedAsset.encodedAssetId;
  encryptedNoteB.commitment = event.params.newNoteBCommitment;

  encryptedNoteB.save();

  const newNoteB = new EncodedOrEncryptedNote(id);
  newNoteB.merkleIndex = event.params.newNoteBIndex;
  newNoteB.encryptedNote = id;
  newNoteB.save();
}

export function handleRefund(event: RefundProcessed): void {
  const totalLogIndex = getTotalLogIndex(event);

  const idx = getTotalEntityIndex(totalLogIndex, 0);
  const id = toPaddedHexString(idx);
  const newNote = new EncodedOrEncryptedNote(id);
  const encodedNote = new EncodedNote(id);

  const refundAddr = event.params.refundAddr;

  encodedNote.ownerH1 = refundAddr.h1;
  encodedNote.ownerH2 = refundAddr.h2;
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

  const idx = getTotalEntityIndex(totalLogIndex, 0);
  const id = toPaddedHexString(idx);
  const commit = new SubtreeCommit(id);

  commit.newRoot = event.params.newRoot;
  commit.subtreeBatchOffset = event.params.subtreeBatchOffset;
  commit.save();
}

export function handleFilledBatchWithZeros(event: FilledBatchWithZeros): void {
  const totalLogIndex = getTotalLogIndex(event);

  const idx = getTotalEntityIndex(totalLogIndex, 0);
  const id = toPaddedHexString(idx);
  const commit = new FilledBatchWithZerosEvent(id);

  commit.startIndex = event.params.startIndex;
  commit.numZeros = event.params.numZeros;
  commit.save();
}
