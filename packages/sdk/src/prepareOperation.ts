import { Wallet } from "@nocturne-xyz/contracts";
import { NotesDB } from "./db";
import { OperationRequest, JoinSplitRequest } from "./operationRequest";
import { MerkleProver } from "./merkleProver";
import { Note, NoteTrait, IncludedNote } from "./note";
import { Asset, AssetTrait } from "./asset";
import {
  min,
  iterChunks,
  getJoinSplitRequestTotalValue,
  simulateOperation,
} from "./utils";
import {
  BLOCK_GAS_LIMIT,
  PreProofJoinSplit,
  PreSignOperation,
} from "./commonTypes";
import {
  NocturneSigner,
  CanonAddress,
  StealthAddressTrait,
  encryptNote,
  randomBigInt,
} from "./crypto";
import { MerkleProofInput } from "./proof";

export const DEFAULT_VERIFICATION_GAS_LIMIT = 1_000_000n;

export async function hasEnoughBalance(
  requestedAmount: bigint,
  asset: Asset,
  notesDB: NotesDB
): Promise<boolean> {
  // check that the user has enough notes to cover the request
  const notes = await notesDB.getNotesFor(asset);
  const balance = notes.reduce((acc, note) => acc + note.value, 0n);
  console.log(`Have: ${balance}. Requested: ${requestedAmount}`);
  return balance >= requestedAmount;
}

export async function prepareOperation(
  opRequest: OperationRequest,
  notesDB: NotesDB,
  merkle: MerkleProver,
  signer: NocturneSigner,
  walletContract: Wallet
): Promise<PreSignOperation> {
  let { refundAddr, maxNumRefunds, gasPrice } = opRequest;

  const { actions, joinSplitRequests, refundAssets, executionGasLimit } =
    opRequest;

  // prepare joinSplits
  const joinSplits = (
    await Promise.all(
      joinSplitRequests.map((joinSplitRequest) =>
        prepareJoinSplits(joinSplitRequest, notesDB, merkle, signer)
      )
    )
  ).flat();
  const encodedRefundAssets = refundAssets.map(AssetTrait.encode);

  // defaults
  // wallet implementations should independently fetch and set the gas price. The fallback of zero probably won't work
  refundAddr = refundAddr ?? signer.generateRandomStealthAddress();
  gasPrice = gasPrice ?? 0n;
  maxNumRefunds =
    maxNumRefunds ??
    BigInt(joinSplitRequests.length + refundAssets.length) + 5n;

  // construct op.
  let op: Partial<PreSignOperation> = {
    actions,
    joinSplits,
    refundAddr,
    encodedRefundAssets,
    maxNumRefunds,
    gasPrice,

    // this may be undefined
    executionGasLimit,
  };

  // simulate if either of the gas limits are undefined
  const simulationRequired = !executionGasLimit;
  if (simulationRequired) {
    op = await getGasEstimatedOperation(op, walletContract);
  }

  return op as PreSignOperation;
}

export async function prepareJoinSplits(
  joinSplitRequest: JoinSplitRequest,
  notesDB: NotesDB,
  merkle: MerkleProver,
  signer: NocturneSigner
): Promise<PreProofJoinSplit[]> {
  const notes = await gatherNotes(
    getJoinSplitRequestTotalValue(joinSplitRequest),
    joinSplitRequest.asset,
    notesDB
  );
  const unwrapAmount = joinSplitRequest.unwrapValue;
  const paymentAmount = joinSplitRequest.payment?.value ?? 0n;

  const totalNotesValue = notes.reduce((acc, note) => acc + note.value, 0n);
  const amountToReturn = totalNotesValue - unwrapAmount - paymentAmount;

  const receiver = joinSplitRequest.payment?.receiver;

  return await getJoinSplitsFromNotes(
    signer,
    merkle,
    notes,
    paymentAmount,
    amountToReturn,
    receiver
  );
}

async function gatherNotes(
  requestedAmount: bigint,
  asset: Asset,
  notesDB: NotesDB
): Promise<IncludedNote[]> {
  // check that the user has enough notes to cover the request
  const notes = await notesDB.getNotesFor(asset);
  const balance = notes.reduce((acc, note) => acc + note.value, 0n);
  if (balance < requestedAmount) {
    throw new Error(
      `Attempted to spend more funds than owned. Address: ${asset.assetAddr}. Attempted: ${requestedAmount}. Owned: ${balance}.`
    );
  }

  // Goal: want to utilize small notes so they don't pile up.
  //       But we also don't want to use too many notes because that will increase the gas cost.
  //       So we take the following approach that strikes a good balance
  // 1. sort notes from small to large
  // 2. compute the sums of each sequence of notes starting from the smallest.
  //    Stop when the sum is >= to the requested amount.
  // 3. until we've gathered notes totalling at least the requested amount, repeat the following:
  //    a. find the smallest subsequence sum that is >= to the remaining amount to gather
  //    b. add the largest note of that subsequence to the set of notes to use.

  // 1. Sort notes from small to large
  const sortedNotes = sortNotesByValue(notes);

  // 2. compute the subsequence sums
  const subsequenceSums: bigint[] = [];
  let curr = 0n;
  for (const note of sortedNotes) {
    curr += note.value;
    subsequenceSums.push(curr);
  }

  // 3. Construct the set of notes to use.
  const notesToUse: IncludedNote[] = [];
  let remainingAmount = requestedAmount;
  let subseqIndex = subsequenceSums.length - 1;
  while (remainingAmount > 0n) {
    // find the index of smallest subsequence sum >= remaining amount to gather
    // the note at that index is the next note to add
    while (
      subseqIndex > 0 &&
      subsequenceSums[subseqIndex - 1] >= remainingAmount
    ) {
      subseqIndex--;
    }

    const note = sortedNotes[subseqIndex];
    notesToUse.push(note);
    remainingAmount -= note.value;
  }

  return notesToUse;
}

async function getJoinSplitsFromNotes(
  signer: NocturneSigner,
  merkle: MerkleProver,
  notes: IncludedNote[],
  paymentAmount: bigint,
  amountLeftOver: bigint,
  receiver?: CanonAddress
): Promise<PreProofJoinSplit[]> {
  // add a dummy note if there are an odd number of notes.
  if (notes.length % 2 == 1) {
    const newAddr = signer.generateRandomStealthAddress();
    const nonce = randomBigInt();
    notes.push({
      owner: newAddr,
      nonce,
      asset: notes[0].asset,
      value: 0n,
      merkleIndex: 0,
    });
  }

  // for each pair of notes, create a JoinSplit with the maximum possible value transfer
  const res = [];
  let remainingPayment = paymentAmount;
  let remainingAmountLeftOver = amountLeftOver;
  for (const [noteA, noteB] of iterChunks(notes, 2)) {
    const pairTotalValue = noteA.value + noteB.value;
    const amountToReturn = min(remainingAmountLeftOver, pairTotalValue);
    remainingAmountLeftOver -= amountToReturn;

    const remainingPairValue = pairTotalValue - amountToReturn;
    const paymentAmount = min(remainingPairValue, remainingPayment);
    remainingPayment -= paymentAmount;

    const joinSplit = await makeJoinSplit(
      signer,
      merkle,
      noteA,
      noteB,
      paymentAmount,
      amountToReturn,
      receiver
    );

    res.push(joinSplit);
  }

  return res;
}

async function makeJoinSplit(
  signer: NocturneSigner,
  merkle: MerkleProver,
  oldNoteA: IncludedNote,
  oldNoteB: IncludedNote,
  paymentAmount: bigint,
  amountToReturn: bigint,
  receiver?: CanonAddress
): Promise<PreProofJoinSplit> {
  const sender = signer.canonicalAddress();
  // if receiver not given, assumme the sender is the receiver
  receiver = receiver ?? sender;

  const encodedAsset = AssetTrait.encode(oldNoteA.asset);

  // whatever isn't being sent to the receiver or ourselves is unwrapped and spent in cleartext (presumably as part of an action)
  const totalValue = oldNoteA.value + oldNoteB.value;
  const publicSpend = totalValue - amountToReturn - paymentAmount;

  const nullifierA = signer.createNullifier(oldNoteA);
  const nullifierB = signer.createNullifier(oldNoteB);

  // first note contains the leftovers - return to sender
  const newNoteA: Note = {
    owner: StealthAddressTrait.fromCanonAddress(sender),
    nonce: signer.generateNewNonce(nullifierA),
    asset: oldNoteA.asset,
    value: amountToReturn,
  };

  // the second note contains the confidential payment
  const newNoteB: Note = {
    owner: StealthAddressTrait.fromCanonAddress(receiver),
    nonce: signer.generateNewNonce(nullifierB),
    asset: oldNoteA.asset,
    value: paymentAmount,
  };

  const newNoteACommitment = NoteTrait.toCommitment(newNoteA);
  const newNoteBCommitment = NoteTrait.toCommitment(newNoteB);

  const newNoteAEncrypted = encryptNote(sender, newNoteA);
  const newNoteBEncrypted = encryptNote(receiver, newNoteB);

  const membershipProof = await merkle.getProof(oldNoteA.merkleIndex);
  const commitmentTreeRoot = membershipProof.root;
  const merkleProofA: MerkleProofInput = {
    path: membershipProof.pathIndices.map((n) => BigInt(n)),
    siblings: membershipProof.siblings,
  };

  // noteB could have been a dummy note. If it is, we simply duplicate the merkle proof for noteA
  // the circuit will ignore the merkle proof for noteB if it has a value of 0
  const noteBIsDummy = oldNoteB.value === 0n;
  let merkleProofB: MerkleProofInput;
  if (noteBIsDummy) {
    merkleProofB = merkleProofA;
  } else {
    const membershipProof = await merkle.getProof(oldNoteB.merkleIndex);

    // ! merkle tree could be asynchronously updated between us getting the first and second merkle proofs
    // TODO: add a `merkle.getManyProofs` method that does it in one go
    if (membershipProof.root !== commitmentTreeRoot) {
      throw Error(
        "MerkleProver was updated between getting the first and second merkle proofs!"
      );
    }

    merkleProofB = {
      path: membershipProof.pathIndices.map((n) => BigInt(n)),
      siblings: membershipProof.siblings,
    };
  }

  return {
    encodedAsset,
    publicSpend,

    nullifierA,
    nullifierB,
    oldNoteA,
    oldNoteB,

    newNoteA,
    newNoteB,
    newNoteAEncrypted,
    newNoteBEncrypted,

    commitmentTreeRoot,
    newNoteACommitment,
    newNoteBCommitment,
    merkleProofA,
    merkleProofB,
  };
}

async function getGasEstimatedOperation(
  op: Partial<PreSignOperation>,
  walletContract: Wallet
): Promise<PreSignOperation> {
  op.executionGasLimit = op.executionGasLimit ?? BLOCK_GAS_LIMIT;
  op.gasPrice = op.gasPrice ?? 0n;

  console.log("Simulating op");
  const result = await simulateOperation(
    op as PreSignOperation,
    walletContract
  );
  if (!result.opProcessed) {
    throw Error("Cannot estimate gas with Error: " + result.failureReason);
  }
  // Give 20% over-estimate
  op.executionGasLimit = (result.executionGas * 12n) / 10n;

  // since we're simulating, we can get the number of refunds while we're at it
  op.maxNumRefunds = result.numRefunds;

  return op as PreSignOperation;
}

function sortNotesByValue<T extends Note>(notes: T[]): T[] {
  return notes.sort((a, b) => {
    return Number(a.value - b.value);
  });
}

export const __private = {
  sortNotesByValue,
  gatherNotes,
};
