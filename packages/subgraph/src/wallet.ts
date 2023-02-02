import { BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import {
  InsertNoteCommitments,
  InsertNotes,
  JoinSplit,
  Refund,
  SubtreeUpdate,
} from "../generated/Wallet/Wallet";
import {
  EncodedNote,
  EncodedOrEncryptedNote,
  EncryptedNote,
  SubtreeCommit,
  TreeInsertion,
} from "../generated/schema";

// assumes txIndex and logIndex are less than 2^32. in practice this is a pretty safe assumption (a block should never have billions of txs/log entries)
function getTotalIndex(event: ethereum.Event): BigInt {
  const blockNumber = event.block.number;
  const txIndex = event.transaction.index;
  const logIndex = event.logIndex;

  return blockNumber.leftShift(32).plus(txIndex).leftShift(32).plus(logIndex);
}

function getId(totalLogIndex: BigInt, index: number): Bytes {
  const idNum = totalLogIndex
    .leftShift(32)
    .plus(BigInt.fromI32(index as i32));

  const without0x = idNum.toHexString().slice(2);
  const padded = without0x.padStart(192, "0");

  return Bytes.fromHexString("0x" + padded);
}

export function handleInsertNoteCommitments(
  event: InsertNoteCommitments
): void {
  const totalLogIndex = getTotalIndex(event);
  const commitments = event.params.commitments;

  for (let i = 0; i < commitments.length; i++) {
    const commitment = commitments[i];
    const id = getId(totalLogIndex, i);

    const leaf = new TreeInsertion(id);
    leaf.noteCommitment = commitment;
    leaf.save();
  }
}

export function handleInsertNotes(event: InsertNotes): void {
  const totalLogIndex = getTotalIndex(event);
  const notes = event.params.notes;

  for (let i = 0; i < notes.length; i++) {
    const noteValues = notes[i];
    const id = getId(totalLogIndex, i);

    const note = new EncodedNote(id);
    note.ownerH1 = noteValues.ownerH1;
    note.ownerH2 = noteValues.ownerH2;
    note.nonce = noteValues.nonce;
    note.encodedAssetAddr = noteValues.encodedAssetAddr;
    note.encodedAssetId = noteValues.encodedAssetId;
    note.value = noteValues.value;
    note.save();

    const insertion = new TreeInsertion(id);
    insertion.note = id;
    insertion.save();
  }
}

export function handleJoinSplit(event: JoinSplit): void {
  const totalLogIndex = getTotalIndex(event);
  const joinSplitTx = event.params.joinSplitTx;

  // unpack first new note
  let id = getId(totalLogIndex, 0);

  const encryptedNoteA = new EncryptedNote(id);

  const newNoteATransmission = joinSplitTx.newNoteATransmission;
  encryptedNoteA.ownerH1X = newNoteATransmission.owner.h1X;
  encryptedNoteA.ownerH1Y = newNoteATransmission.owner.h1Y;
  encryptedNoteA.ownerH2X = newNoteATransmission.owner.h2X;
  encryptedNoteA.ownerH2Y = newNoteATransmission.owner.h2Y;

  encryptedNoteA.encappedKey = newNoteATransmission.encappedKey;
  encryptedNoteA.encryptedNonce = newNoteATransmission.encryptedNonce;
  encryptedNoteA.encryptedValue = newNoteATransmission.encryptedValue;

  encryptedNoteA.encodedAssetAddr = joinSplitTx.encodedAsset.encodedAssetAddr;
  encryptedNoteA.encodedAssetId = joinSplitTx.encodedAsset.encodedAssetId;
  encryptedNoteA.commitment = joinSplitTx.newNoteACommitment;

  encryptedNoteA.save();

  const newNoteA = new EncodedOrEncryptedNote(id);
  newNoteA.merkleIndex = event.params.newNoteAIndex;
  newNoteA.encryptedNote = id;
  newNoteA.save();

  // unpack second new note
  id = getId(totalLogIndex, 1);

  const encryptedNoteB = new EncryptedNote(id);

  const newNoteBTransmission = joinSplitTx.newNoteBTransmission;
  encryptedNoteB.ownerH1X = newNoteBTransmission.owner.h1X;
  encryptedNoteB.ownerH1Y = newNoteBTransmission.owner.h1Y;
  encryptedNoteB.ownerH2X = newNoteBTransmission.owner.h2X;
  encryptedNoteB.ownerH2Y = newNoteBTransmission.owner.h2Y;

  encryptedNoteB.encappedKey = newNoteBTransmission.encappedKey;
  encryptedNoteB.encryptedNonce = newNoteBTransmission.encryptedNonce;
  encryptedNoteB.encryptedValue = newNoteBTransmission.encryptedValue;

  encryptedNoteB.encodedAssetAddr = joinSplitTx.encodedAsset.encodedAssetAddr;
  encryptedNoteB.encodedAssetId = joinSplitTx.encodedAsset.encodedAssetId;
  encryptedNoteB.commitment = joinSplitTx.newNoteBCommitment;

  encryptedNoteB.save();

  const newNoteB = new EncodedOrEncryptedNote(id);
  newNoteB.merkleIndex = event.params.newNoteBIndex;
  newNoteB.encryptedNote = id;
  newNoteB.save();
}

export function handleRefund(event: Refund): void {
  const totalLogIndex = getTotalIndex(event);

  const id = getId(totalLogIndex, 0);
  const newNote = new EncodedOrEncryptedNote(id);
  const encodedNote = new EncodedNote(id);

  const refundAddr = event.params.refundAddr;

  encodedNote.ownerH1 = refundAddr.h1X;
  encodedNote.ownerH2 = refundAddr.h2X;
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
  const totalLogIndex = getTotalIndex(event);

  const id = getId(totalLogIndex, 0);
  const commit = new SubtreeCommit(id);

  commit.newRoot = event.params.newRoot;
  commit.subtreeIndex = event.params.subtreeIndex;
  commit.save();
}
