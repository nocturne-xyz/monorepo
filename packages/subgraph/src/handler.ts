import {
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
} from "../generated/schema";
import {
  getTotalLogIndex,
  getTotalEntityIndex,
  toPadded32BArray,
} from "./utils";

export function handleJoinSplit(event: JoinSplitProcessed): void {
  const totalLogIndex = getTotalLogIndex(event);
  const joinSplit = event.params.joinSplit;

  // first old note's nullifier
  let idx = getTotalEntityIndex(totalLogIndex, 0);
  const nullifierA = new Nullifier(toPadded32BArray(idx));
  nullifierA.idx = idx;
  nullifierA.nullifier = event.params.oldNoteANullifier;
  nullifierA.save();

  // second old note's nullfier
  idx = getTotalEntityIndex(totalLogIndex, 1);
  const nullifierB = new Nullifier(toPadded32BArray(idx));
  nullifierB.idx = idx;
  nullifierB.nullifier = event.params.oldNoteBNullifier;
  nullifierB.save();

  // unpack first new note
  idx = getTotalEntityIndex(totalLogIndex, 2);
  let id = toPadded32BArray(idx);

  const encryptedNoteA = new EncryptedNote(id);
  const newNoteAEncrypted = joinSplit.newNoteAEncrypted;
  encryptedNoteA.idx = idx;
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
  newNoteA.idx = idx;
  newNoteA.merkleIndex = event.params.newNoteAIndex;
  newNoteA.encryptedNote = id;
  newNoteA.save();

  // unpack second new note

  idx = getTotalEntityIndex(totalLogIndex, 2);
  id = toPadded32BArray(idx);
  const encryptedNoteB = new EncryptedNote(id);

  const newNoteBEncrypted = joinSplit.newNoteBEncrypted;
  encryptedNoteB.idx = idx;
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
  newNoteB.idx = idx;
  newNoteB.merkleIndex = event.params.newNoteBIndex;
  newNoteB.encryptedNote = id;
  newNoteB.save();
}

export function handleRefund(event: RefundProcessed): void {
  const totalLogIndex = getTotalLogIndex(event);

  const idx = getTotalEntityIndex(totalLogIndex, 0);
  const id = toPadded32BArray(idx);
  const newNote = new EncodedOrEncryptedNote(id);
  const encodedNote = new EncodedNote(id);

  const refundAddr = event.params.refundAddr;

  encodedNote.idx = idx;
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
  newNote.idx = idx;
  newNote.save();
}

export function handleSubtreeUpdate(event: SubtreeUpdate): void {
  const totalLogIndex = getTotalLogIndex(event);

  const idx = getTotalEntityIndex(totalLogIndex, 0);
  const id = toPadded32BArray(idx);
  const commit = new SubtreeCommit(id);

  commit.newRoot = event.params.newRoot;
  commit.subtreeIndex = event.params.subtreeIndex;
  commit.idx = idx;
  commit.save();
}
