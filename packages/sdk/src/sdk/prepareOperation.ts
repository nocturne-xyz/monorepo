import { Wallet } from "@nocturne-xyz/contracts";
import {
  Asset,
  AssetTrait,
  IncludedNote,
  JoinSplitRequest,
  MerkleProver,
  NocturneSigner,
  Note,
  NoteTrait,
  NotesDB,
  OperationRequest,
  getJoinSplitRequestTotalValue,
  iterChunks,
  min,
  simulateOperation,
  sortNotesByValue,
} from ".";
import {
  BLOCK_GAS_LIMIT,
  PreSignJoinSplit,
  PreSignOperation,
} from "../commonTypes";
import { CanonAddress, StealthAddressTrait } from "../crypto";
import { encryptNote, randomBigInt } from "../crypto/utils";
import { MerkleProofInput } from "../proof";

export const DEFAULT_VERIFICATION_GAS_LIMIT = 1_000_000n;

type GasEstimationResult = {
  verificationGasLimit: bigint;
  executionGasLimit: bigint;
  maxNumRefunds: bigint;
};

export async function prepareOperation(
  opRequest: OperationRequest,
  notesDB: NotesDB,
  merkle: MerkleProver,
  signer: NocturneSigner,
  walletContract: Wallet
): Promise<PreSignOperation> {
  let {
    joinSplitRequests,
    refundAssets,
    verificationGasLimit,
    executionGasLimit,
    gasPrice,
    actions,
    maxNumRefunds,
    refundAddr,
  } = opRequest;

  // defaults
  // wallet implementations should independently fetch and set the gas price. The fallback of zero probably won't work
  // `verificationGasLimit` and `executionGasLimit` are set via simulation if they are not provided.
  //  In that case, `maxNumRefunds` will be overwritten by the simulation result
  refundAddr = refundAddr ?? StealthAddressTrait.randomize(signer.address);
  maxNumRefunds =
    maxNumRefunds ??
    BigInt(joinSplitRequests.length + refundAssets.length) + 5n;
  gasPrice = gasPrice ?? 0n;

  // prepare joinSplits
  const joinSplitses = await Promise.all(
    joinSplitRequests.map((joinSplitRequest) =>
      prepareJoinSplits(joinSplitRequest, notesDB, merkle, signer)
    )
  );
  const joinSplits = joinSplitses.flat();

  // construct op.
  // apply defaults for gas limits so that they're set in the case
  // we need to simulate
  const encodedRefundAssets = refundAssets.map(AssetTrait.encode);
  const op: PreSignOperation = {
    actions,
    joinSplits,
    refundAddr,
    encodedRefundAssets,
    maxNumRefunds,

    gasPrice,
    // if either of these are nullish, we will simulate and overwrite them (and `maxNumRefunds`)
    verificationGasLimit:
      verificationGasLimit ?? DEFAULT_VERIFICATION_GAS_LIMIT,
    executionGasLimit: executionGasLimit ?? BLOCK_GAS_LIMIT,
  };

  // simulate if any of the gas limits are missing
  const simulationRequired = !verificationGasLimit || !executionGasLimit;
  if (simulationRequired) {
    // make simulateOperation also return gasPrice
    const { verificationGasLimit, executionGasLimit, maxNumRefunds } =
      await estimateGasForOperation(op, walletContract);
    op.verificationGasLimit = verificationGasLimit;
    op.executionGasLimit = executionGasLimit;
    op.maxNumRefunds = maxNumRefunds;
  }

  return op;
}

export async function prepareJoinSplits(
  joinSplitRequest: JoinSplitRequest,
  notesDB: NotesDB,
  merkle: MerkleProver,
  signer: NocturneSigner
): Promise<PreSignJoinSplit[]> {
  const notes = await gatherNotes(
    getJoinSplitRequestTotalValue(joinSplitRequest),
    joinSplitRequest.asset,
    notesDB
  );
  const totalNotesValue = notes.reduce((acc, note) => acc + note.value, 0n);
  const unwrapAmount = joinSplitRequest.unwrapValue;
  const paymentAmount = joinSplitRequest.payment?.value ?? 0n;
  const amountLeftOver = totalNotesValue - unwrapAmount - paymentAmount;
  const receiver = joinSplitRequest.payment?.receiver;

  // add a dummy note if there are an odd number of notes.
  if (notes.length % 2 == 1) {
    const newAddr = StealthAddressTrait.randomize(signer.address);
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
    const amountLeftOver = min(remainingAmountLeftOver, pairTotalValue);
    remainingAmountLeftOver -= amountLeftOver;

    const remainingPairValue = pairTotalValue - amountLeftOver;
    const paymentAmount = min(remainingPairValue, remainingPayment);
    remainingPayment -= paymentAmount;

    const joinSplit = await makeJoinSplit(
      signer,
      merkle,
      noteA,
      noteB,
      amountLeftOver,
      paymentAmount,
      receiver
    );

    res.push(joinSplit);
  }

  return res;
}

export async function hasEnoughBalance(
  requestedAmount: bigint,
  asset: Asset,
  notesDB: NotesDB
): Promise<boolean> {
  // check that the user has enough notes to cover the request
  const notes = await notesDB.getNotesFor(asset);
  const balance = notes.reduce((acc, note) => acc + note.value, 0n);
  return balance >= requestedAmount;
}

export async function gatherNotes(
  requestedAmount: bigint,
  asset: Asset,
  notesDB: NotesDB
): Promise<IncludedNote[]> {
  // check that the user has enough notes to cover the request
  const notes = await notesDB.getNotesFor(asset);
  const balance = notes.reduce((acc, note) => acc + note.value, 0n);
  if (!(await hasEnoughBalance(requestedAmount, asset, notesDB))) {
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

export async function makeJoinSplit(
  signer: NocturneSigner,
  merkle: MerkleProver,
  oldNoteA: IncludedNote,
  oldNoteB: IncludedNote,
  amountLeftOver: bigint,
  paymentAmount: bigint,
  receiver?: CanonAddress
): Promise<PreSignJoinSplit> {
  const sender = signer.privkey.toCanonAddress();
  // if receiver not given, assumme the sender is the receiver
  receiver = receiver ?? sender;

  const encodedAsset = AssetTrait.encode(oldNoteA.asset);

  // whatever isn't being sent to the receiver or ourselves is unwrapped and spent in cleartext (presumably as part of an action)
  const totalValue = oldNoteA.value + oldNoteB.value;
  const publicSpend = totalValue - amountLeftOver - paymentAmount;

  const nullifierA = signer.createNullifier(oldNoteA);
  const nullifierB = signer.createNullifier(oldNoteB);

  // first note contains the leftovers - return to sender
  const newNoteA: Note = {
    owner: StealthAddressTrait.fromCanonAddress(sender),
    nonce: signer.generateNewNonce(nullifierA),
    asset: oldNoteA.asset,
    value: amountLeftOver,
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

async function estimateGasForOperation(
  op: PreSignOperation,
  walletContract: Wallet
): Promise<GasEstimationResult> {
  console.log("Simulating op");
  const result = await simulateOperation(op, walletContract);
  if (!result.opProcessed) {
    throw Error("Cannot estimate gas with Error: " + result.failureReason);
  }
  // Give 20% over-estimate
  const executionGasLimit = (result.executionGas * 12n) / 10n;
  const verificationGasLimit = (result.verificationGas + 12n) / 10n;

  // since we're simulating, we can get the number of refunds while we're at it
  const maxNumRefunds = result.numRefunds;
  return {
    executionGasLimit,
    verificationGasLimit,
    maxNumRefunds,
  };
}
