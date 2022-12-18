import {
  JoinSplitRequest,
  Asset,
  AssetWithBalance,
  OperationRequest,
  packToSolidityProof,
  EncodedAsset,
} from "./commonTypes";
import {
  PreSignJoinSplitTx,
  PreProofJoinSplitTx,
  ProvenJoinSplitTx,
  PreSignOperation,
  PreProofOperation,
  ProvenOperation,
} from "./commonTypes";
import { Note, IncludedNote, NoteTrait, encodeAsset } from "./sdk/note";
import { NocturneSigner, NocturneSignature } from "./sdk/signer";
import { CanonAddress, NocturneAddressTrait } from "./crypto/address";
import { calculateOperationDigest } from "./contract/utils";
import {
  JoinSplitProver,
  JoinSplitInputs,
  joinSplitPublicSignalsFromArray,
} from "./proof/joinsplit";
import { LocalMerkleProver, MerkleProver } from "./sdk/merkleProver";
import { NotesDB } from "./sdk/db";
import { NotesManager, getJoinSplitRequestTotalValue } from "./sdk";
import { MerkleProofInput } from "./proof";
import { genNoteTransmission } from "./crypto/utils";

export interface JoinSplitNotes {
  oldNoteA: IncludedNote;
  oldNoteB: IncludedNote;
  newNoteA: Note;
  newNoteB: Note;
}

export class NocturneContext {
  readonly signer: NocturneSigner;
  protected prover: JoinSplitProver;
  protected merkleProver: MerkleProver;
  protected notesManager: NotesManager;
  readonly db: NotesDB;

  constructor(
    signer: NocturneSigner,
    prover: JoinSplitProver,
    merkleProver: MerkleProver,
    notesManager: NotesManager,
    db: NotesDB
  ) {
    this.signer = signer;
    this.prover = prover;
    this.merkleProver = merkleProver;
    this.notesManager = notesManager;
    this.db = db;
  }

  async syncNotes(): Promise<void> {
    await this.notesManager.fetchAndStoreNewNotesFromRefunds();
    await this.notesManager.fetchAndApplyNewJoinSplits();
  }

  async syncLeaves(): Promise<void> {
    if (this.merkleProver.isLocal()) {
      await (this.merkleProver as LocalMerkleProver).fetchLeavesAndUpdate();
    } else {
      throw Error("Attempted to sync leaves for non-local merkle prover");
    }
  }

  /**
   * Attempt to create a `ProvenOperation` provided an `OperationRequest`.
   * `NocturneContext` will attempt to gather all notes to fulfill the
   * operation request's asset requests. It will then generate joinsplit proofs
   * for each and include that in the final `ProvenOperation`.
   *
   * @param OperationRequest Asset requested to spend
   * @param joinSplit{Wasm,Zkey}Path paths to circuit runtime and prooving key
   * @param refundAddr Optional refund address. Context will generate
   * rerandomized address if left empty
   * @param gasLimit Gas limit
   */
  async tryCreateProvenOperation(
    operationRequest: OperationRequest
  ): Promise<ProvenOperation> {
    const preProofOp: PreProofOperation = await this.tryGetPreProofOperation(
      operationRequest
    );

    const allProofPromises: Promise<ProvenJoinSplitTx>[] =
      preProofOp.joinSplitTxs.map((tx) => {
        return this.proveJoinSplitTx(tx);
      });

    return {
      joinSplitTxs: await Promise.all(allProofPromises),
      refundAddr: preProofOp.refundAddr,
      encodedRefundAssets: preProofOp.encodedRefundAssets,
      actions: preProofOp.actions,
      gasLimit: preProofOp.gasLimit,
      gasPrice: preProofOp.gasPrice,
      maxNumRefunds: preProofOp.maxNumRefunds,
    };
  }

  /**
   *
   * Given `operationRequest`, gather the necessary notes and proof inputs to
   * fulfill the operation's asset requests. Return the PreProofJoinSplitTx and
   * proof inputs.
   *
   * @param operationRequest Operation request
   * @param refundAddr Optional refund address. Context will generate
   * rerandomized address if left empty
   * @param gasLimit Gas limit
   */
  async tryGetPreProofOperation(
    operationRequest: OperationRequest
  ): Promise<PreProofOperation> {
    // Create preProofOperation to use in per-note proving
    const preSignOperation = await this.getPreSignOperation(operationRequest);

    // Sign the preSignOperation
    const opDigest = calculateOperationDigest(preSignOperation);
    const opSig = this.signer.sign(opDigest);

    const preProofJoinSplitTxs: PreProofJoinSplitTx[] = await Promise.all(
      preSignOperation.joinSplitTxs.map((tx) => {
        return this.genPreProofJoinSplitTx(tx, opDigest, opSig);
      })
    );

    return {
      joinSplitTxs: preProofJoinSplitTxs,
      refundAddr: preSignOperation.refundAddr,
      encodedRefundAssets: preSignOperation.encodedRefundAssets,
      actions: preSignOperation.actions,
      gasLimit: preSignOperation.gasLimit,
      gasPrice: preSignOperation.gasPrice,
      maxNumRefunds: preSignOperation.maxNumRefunds,
    };
  }

  /**
   * Ensure user has balances to fullfill all asset requests in
   * `operationRequest`. Throws error if any asset request exceeds owned balance.
   *
   * @param joinSplitRequests requests
   */
  async ensureMinimumForOperationRequest({
    joinSplitRequests,
  }: OperationRequest): Promise<void> {
    for (const joinSplitRequest of joinSplitRequests) {
      await this.ensureMinimumForAssetRequest(joinSplitRequest);
    }
  }

  /**
   * Generate a `ProvenJoinSplitTx` from a `PreProofJoinSplitTx`
   */
  protected async proveJoinSplitTx(
    preProofJoinSplitTx: PreProofJoinSplitTx
  ): Promise<ProvenJoinSplitTx> {
    const { opDigest, proofInputs, ...baseJoinSplitTx } = preProofJoinSplitTx;
    const proof = await this.prover.proveJoinSplit(proofInputs);

    // Check that snarkjs output is consistent with our precomputed joinsplit values
    const publicSignals = joinSplitPublicSignalsFromArray(proof.publicSignals);
    if (
      baseJoinSplitTx.newNoteACommitment != publicSignals.newNoteACommitment ||
      baseJoinSplitTx.newNoteBCommitment != publicSignals.newNoteBCommitment ||
      baseJoinSplitTx.commitmentTreeRoot != publicSignals.commitmentTreeRoot ||
      baseJoinSplitTx.publicSpend != publicSignals.publicSpend ||
      baseJoinSplitTx.nullifierA != publicSignals.nullifierA ||
      baseJoinSplitTx.nullifierB != publicSignals.nullifierB ||
      baseJoinSplitTx.nullifierB != publicSignals.nullifierB ||
      baseJoinSplitTx.encodedAddr != publicSignals.encodedAddr ||
      baseJoinSplitTx.encodedId != publicSignals.encodedId ||
      opDigest != publicSignals.opDigest
    ) {
      throw new Error(
        `SnarkJS generated public input differs from precomputed ones.`
      );
    }

    const solidityProof = packToSolidityProof(proof.proof);
    return {
      proof: solidityProof,
      ...baseJoinSplitTx,
    };
  }

  /**
   * Generate a sequence of joinSplitTx for a given joinSplitRequest.
   */
  async genPreSignJoinSplitTxs(
    joinSplitRequest: JoinSplitRequest
  ): Promise<PreSignJoinSplitTx[]> {
    let notesToUse = await this.gatherMinimumNotes(joinSplitRequest);

    const unwrapVal = joinSplitRequest.unwrapValue;
    const paymentVal = joinSplitRequest.paymentIntent
      ? joinSplitRequest.paymentIntent.value
      : 0n;
    const receiver = joinSplitRequest.paymentIntent
      ? joinSplitRequest.paymentIntent.receiver
      : undefined;

    // Total value of notes in notesToUse
    const totalUsedValue = notesToUse.reduce((s, note) => {
      return s + note.value;
    }, 0n);
    // Compute return value
    const returnVal = totalUsedValue - unwrapVal - paymentVal;

    // Insert a dummy note if length of notes to use is odd
    if (notesToUse.length % 2 == 1) {
      const newAddr = this.signer.privkey.toCanonAddressStruct();
      notesToUse.push({
        owner: newAddr,
        nonce: 0n,
        asset: notesToUse[0].asset,
        value: 0n,
        merkleIndex: 0,
      });
    }

    const preSignJoinSplitTxs: Promise<PreSignJoinSplitTx>[] = [];

    let noteA, noteB;
    let remainingPaymentVal = paymentVal;
    let remainingReturnVal = returnVal;
    // Loop through every two notes to use to format a joinsplit
    while (notesToUse.length > 0) {
      [noteA, noteB, ...notesToUse] = notesToUse;

      // First try to make a return note of maximm value
      const totalPairValue = noteA.value + noteB.value;
      const currentReturnVal =
        totalPairValue >= remainingReturnVal
          ? remainingReturnVal
          : totalPairValue;
      remainingReturnVal -= currentReturnVal;

      // Then fit in as much paymentVal as we can
      const remainingJoinSplitVal =
        noteA.value + noteB.value - currentReturnVal;
      const currentPaymentVal =
        remainingJoinSplitVal >= remainingPaymentVal
          ? remainingPaymentVal
          : remainingJoinSplitVal;
      remainingPaymentVal -= currentPaymentVal;

      preSignJoinSplitTxs.push(
        this.genPreSignJoinSplitTx(
          noteA,
          noteB,
          currentReturnVal,
          currentPaymentVal,
          receiver
        )
      );
    }
    return Promise.all(preSignJoinSplitTxs);
  }

  /**
   * Generate a single PreSignJoinSplitTx.
   *
   * @param oldNoteA, oldNoteB old notes to spend
   * @param returnVal value to be given back to the spender
   * @param paymentVal value of the confidential payment
   * @param receiver recipient of the confidential payment
   * @return a PreSignJoinSplitTx
   */
  protected async genPreSignJoinSplitTx(
    oldNoteA: IncludedNote,
    oldNoteB: IncludedNote,
    returnVal: bigint,
    paymentVal = 0n,
    receiver?: CanonAddress
  ): Promise<PreSignJoinSplitTx> {
    const nullifierA = this.signer.createNullifier(oldNoteA);
    const nullifierB = this.signer.createNullifier(oldNoteB);

    const canonOwner = this.signer.privkey.toCanonAddress();
    if (receiver == undefined || paymentVal == 0n) {
      receiver = canonOwner;
    }

    const newNoteA: Note = {
      owner: NocturneAddressTrait.fromCanonAddress(canonOwner),
      nonce: this.signer.generateNewNonce(nullifierA),
      asset: oldNoteA.asset,
      value: returnVal,
    };
    const newNoteB: Note = {
      owner: NocturneAddressTrait.fromCanonAddress(receiver),
      nonce: this.signer.generateNewNonce(nullifierB),
      asset: oldNoteA.asset,
      value: paymentVal,
    };

    const newNoteACommitment = NoteTrait.toCommitment(newNoteA);
    const newNoteBCommitment = NoteTrait.toCommitment(newNoteB);

    const newNoteATransmission = genNoteTransmission(
      this.signer.privkey.toCanonAddress(),
      newNoteA
    );
    const newNoteBTransmission = genNoteTransmission(receiver, newNoteB);
    const publicSpend =
      oldNoteA.value + oldNoteB.value - returnVal - paymentVal;

    const merkleProofA = await this.merkleProver.getProof(oldNoteA.merkleIndex);
    const merkleInputA: MerkleProofInput = {
      path: merkleProofA.pathIndices.map((n) => BigInt(n)),
      siblings: merkleProofA.siblings,
    };

    let merkleInputB;

    if (oldNoteB.value != 0n) {
      const merkleProofB = await this.merkleProver.getProof(
        oldNoteB.merkleIndex
      );
      merkleInputB = {
        path: merkleProofB.pathIndices.map((n) => BigInt(n)),
        siblings: merkleProofB.siblings,
      };
      if (merkleProofA.root != merkleProofB.root) {
        throw Error(
          "Commitment merkle tree was updated during joinsplit creation."
        );
      }
    } else {
      // Note B is dummy. Any input works here
      merkleInputB = merkleInputA;
    }
    const { encodedAddr, encodedId } = encodeAsset(oldNoteA.asset);

    return {
      commitmentTreeRoot: merkleProofA.root,
      nullifierA,
      nullifierB,
      newNoteACommitment,
      newNoteATransmission,
      newNoteBCommitment,
      newNoteBTransmission,
      encodedAddr,
      encodedId,
      publicSpend,
      oldNoteA,
      oldNoteB,
      newNoteA,
      newNoteB,
      merkleInputA,
      merkleInputB,
    };
  }

  /**
   * Given an opeartion request, gather the necessary notes to fulfill the
   * requests and format the data into PreSignOpeartion (all data needed to
   * compute opeartionDigest).
   *
   * @param OperationRequest
   * @param tokens spend and refund token addresses
   * @param refundAddr refund address
   * @param gasLimit
   */
  protected async getPreSignOperation({
    joinSplitRequests,
    refundAddr,
    refundAssets,
    actions,
    gasLimit = 1_000_000n,
    gasPrice = 0n,
    maxNumRefunds,
  }: OperationRequest): Promise<PreSignOperation> {
    // Generate refund addr if needed
    refundAddr = refundAddr
      ? refundAddr
      : NocturneAddressTrait.randomize(this.signer.address);

    // Default max number of refunds does not support minting
    maxNumRefunds = maxNumRefunds
      ? maxNumRefunds
      : BigInt(joinSplitRequests.length + refundAssets.length);

    const preSignJoinSplitTxs: PreSignJoinSplitTx[] = [];
    for (const joinSplitRequest of joinSplitRequests) {
      preSignJoinSplitTxs.push(
        ...(await this.genPreSignJoinSplitTxs(joinSplitRequest))
      );
    }

    const encodedRefundAssets: EncodedAsset[] = refundAssets.map(encodeAsset);

    return {
      joinSplitTxs: preSignJoinSplitTxs,
      refundAddr,
      encodedRefundAssets,
      actions,
      gasLimit,
      gasPrice,
      maxNumRefunds,
    };
  }

  /**
   * Format a PreProofJoinSplitTx from a preSignJoinSplitTx, an
   * operationDigest, and a signature
   *
   * @param preSignJoinSplitTx
   * @param opDigest: operation digest of the operation that the joinsplit is part of
   * @param opSig: signature of the opDigest
   */
  protected async genPreProofJoinSplitTx(
    preSignJoinSplitTx: PreSignJoinSplitTx,
    opDigest: bigint,
    opSig: NocturneSignature
  ): Promise<PreProofJoinSplitTx> {
    const {
      merkleInputA,
      merkleInputB,
      oldNoteA,
      oldNoteB,
      newNoteA,
      newNoteB,
      ...baseJoinSplitTx
    } = preSignJoinSplitTx;

    const proofInputs: JoinSplitInputs = {
      vk: this.signer.privkey.vk,
      spendPk: this.signer.privkey.spendPk(),
      operationDigest: opDigest,
      c: opSig.c,
      z: opSig.z,
      oldNoteA: NoteTrait.encode(oldNoteA),
      oldNoteB: NoteTrait.encode(oldNoteB),
      merkleProofA: merkleInputA,
      merkleProofB: merkleInputB,
      newNoteA: NoteTrait.encode(newNoteA),
      newNoteB: NoteTrait.encode(newNoteB),
    };

    return {
      opDigest,
      proofInputs,
      ...baseJoinSplitTx,
    };
  }

  /**
   * Ensure user has balances to fullfill `joinSplitRequest`. Throws error if
   * attempted request exceeds owned balance.
   *
   * @param joinSplitRequest request
   */
  async ensureMinimumForAssetRequest(
    joinSplitRequest: JoinSplitRequest
  ): Promise<void> {
    const totalVal = getJoinSplitRequestTotalValue(joinSplitRequest);
    const balance = await this.getAssetBalance(joinSplitRequest.asset);
    if (balance < totalVal) {
      throw new Error(
        `Attempted to spend more funds than owned. Address: ${joinSplitRequest.asset.assetAddr}. Attempted: ${joinSplitRequest.unwrapValue}. Owned: ${balance}.`
      );
    }
  }

  /**
   * Gather minimum list of notes required to fulfill asset request. Returned
   * list is sorted from smallest to largest. The total value of returned notes
   * could exceed the requested amount.
   *
   * @param joinSplitRequest request
   * @return a list of included notes to spend.
   */
  async gatherMinimumNotes(
    joinSplitRequest: JoinSplitRequest,
    largestFirst = false
  ): Promise<IncludedNote[]> {
    this.ensureMinimumForAssetRequest(joinSplitRequest);
    const totalVal = getJoinSplitRequestTotalValue(joinSplitRequest);

    const notes = await this.db.getNotesFor(joinSplitRequest.asset);
    // Sort from small to large
    const sortedNotes = [...notes].sort((a, b) => {
      return Number(a.value - b.value);
    });

    // For value to gather, the *required note* is defined as the largest note
    // of the shortest subsequence of notes starting from the smallest whose
    // sum is greater than the value to gather.

    // Compute running sum of each subsequence of notes starting from smallest
    const subTotal: bigint[] = [];
    for (const note of sortedNotes) {
      subTotal.push(
        note.value + (subTotal.length > 0 ? subTotal[subTotal.length - 1] : 0n)
      );
    }

    // Construct a helper function that compute the index of the required note
    // for each value to gather.
    // Possible optimzation: change this to O(log(notes.length)) complexity
    const getRequiredNoteIndexForValue = (valueToGather: bigint) => {
      let index = 0;
      while (subTotal[index] < valueToGather) {
        index++;
      }
      return index;
    };

    // Construct the set of notes to use. Iteractively adding in required notes
    // for the remaining value to gather.
    const notesToUse: IncludedNote[] = [];
    let remainingVal = totalVal;
    while (remainingVal > 0n) {
      const index = getRequiredNoteIndexForValue(remainingVal);
      const oldNote = sortedNotes[index];
      remainingVal -= oldNote.value;
      notesToUse.push(oldNote);
    }

    if (!largestFirst) {
      notesToUse.reverse();
    }

    return notesToUse;
  }

  /**
   * Generate an operation request for a payment.
   */
  genPaymentRequest(
    asset: Asset,
    receiver: CanonAddress,
    value: bigint
  ): OperationRequest {
    return {
      joinSplitRequests: [
        {
          asset,
          unwrapValue: 0n,
          paymentIntent: {
            receiver,
            value,
          },
        },
      ],
      refundAssets: [],
      actions: [],
    };
  }

  /**
   * Sum up the note values for a all notes and return array of assets with
   * their balances.
   *
   * @param asset Asset
   */
  async getAllAssetBalances(): Promise<AssetWithBalance[]> {
    const notes = await this.db.getAllNotes();
    return Array.from(notes.entries()).map(([assetString, notes]) => {
      const asset = NotesDB.parseAssetFromNoteAssetKey(assetString);
      const balance = notes.reduce((a, b) => a + b.value, 0n);
      return {
        asset,
        balance,
      };
    });
  }

  /**
   * Sum up the note values for a given `tokenToNote` entry array.
   *
   * @param asset Asset
   */
  async getAssetBalance(asset: Asset): Promise<bigint> {
    const notes = await this.db.getNotesFor(asset);

    if (!notes) {
      return 0n;
    } else {
      return notes.reduce((a, b) => a + b.value, 0n);
    }
  }
}
