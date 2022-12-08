import {
  JoinSplitRequest,
  Asset,
  AssetWithBalance,
  OperationRequest,
  packToSolidityProof,
} from "./commonTypes";
import { SpendAndRefundTokens } from "./contract/types";
import {
  PreSignJoinSplitTx,
  PreProofJoinSplitTx,
  ProvenJoinSplitTx,
  PreSignOperation,
  PreProofOperation,
  ProvenOperation,
} from "./commonTypes";
import { Note, IncludedNote, NoteTrait } from "./sdk/note";
import { NocturneSigner, NocturneSignature } from "./sdk/signer";
import {
  CanonAddress,
  NocturneAddress,
  NocturneAddressTrait,
} from "./crypto/address";
import { calculateOperationDigest } from "./contract/utils";
import {
  JoinSplitProver,
  JoinSplitInputs,
  joinSplitPublicSignalsFromArray,
} from "./proof/joinsplit";
import { LocalMerkleProver, MerkleProver } from "./sdk/merkleProver";
import { NocturneDB } from "./sdk/db";
import { NotesManager } from "./sdk";
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
  readonly db: NocturneDB;

  constructor(
    signer: NocturneSigner,
    prover: JoinSplitProver,
    merkleProver: MerkleProver,
    notesManager: NotesManager,
    db: NocturneDB
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
    operationRequest: OperationRequest,
    refundAddr?: NocturneAddress,
    gasLimit = 1_000_000n
  ): Promise<ProvenOperation> {
    const preProofOp: PreProofOperation = await this.tryGetPreProofOperation(
      operationRequest,
      refundAddr,
      gasLimit
    );

    const allProofPromises: Promise<ProvenJoinSplitTx>[] =
      preProofOp.joinSplitTxs.map((tx) => {
        return this.proveJoinSplitTx(tx);
      });

    return {
      joinSplitTxs: await Promise.all(allProofPromises),
      refundAddr: preProofOp.refundAddr,
      tokens: preProofOp.tokens,
      actions: preProofOp.actions,
      gasLimit: preProofOp.gasLimit,
    };
  }

  /**
   *
   * Given `operationRequest`, gather the necessary notes and proof inputs to
   *
   * fullfill the operation's asset requests. Return the PreProofJoinSplitTx and
   * proof inputs.
   *
   * @param operationRequest Operation request
   * @param refundAddr Optional refund address. Context will generate
   * rerandomized address if left empty
   * @param gasLimit Gas limit
   */
  async tryGetPreProofOperation(
    operationRequest: OperationRequest,
    refundAddr?: NocturneAddress,
    gasLimit = 1_000_000n
  ): Promise<PreProofOperation> {
    const { joinSplitRequests, refundTokens } = operationRequest;

    // Generate refund addr if needed
    const realRefundAddr = refundAddr
      ? refundAddr
      : NocturneAddressTrait.randomize(this.signer.address);

    // Create preProofOperation to use in per-note proving
    const tokens: SpendAndRefundTokens = {
      spendTokens: joinSplitRequests.map((a) => a.asset.address),
      refundTokens,
    };

    const preSignOperation = await this.getPreSignOperation(
      operationRequest,
      tokens,
      realRefundAddr,
      gasLimit
    );

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
      tokens: preSignOperation.tokens,
      actions: preSignOperation.actions,
      gasLimit: preSignOperation.gasLimit,
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
      BigInt(baseJoinSplitTx.asset) != publicSignals.asset ||
      baseJoinSplitTx.id != publicSignals.id ||
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
   * Generate a PreSignJoinSplitTx.
   *
   * @param oldNoteA, oldNoteB old notes to spend
   * @param refundValue value to be given back to the spender
   * @param paymentValue value of confidential payment
   * @param receiverAddr recipient of confidential payment
   * @return a PreSignJoinSplitTx
   */
  protected async genPreSignJoinSplitTx(
    oldNoteA: IncludedNote,
    oldNoteB: IncludedNote,
    refundValue: bigint,
    paymentValue = 0n,
    receiver?: CanonAddress
  ): Promise<PreSignJoinSplitTx> {
    const nullifierA = this.signer.createNullifier(oldNoteA);
    const nullifierB = this.signer.createNullifier(oldNoteB);

    const canonOwner = this.signer.privkey.toCanonAddress();
    if (receiver == undefined || paymentValue == 0n) {
      receiver = canonOwner;
    }

    const newNoteA: Note = {
      owner: NocturneAddressTrait.fromCanonAddress(canonOwner),
      nonce: this.signer.generateNewNonce(nullifierA),
      asset: oldNoteA.asset,
      id: oldNoteA.id,
      value: refundValue,
    };
    const newNoteB: Note = {
      owner: NocturneAddressTrait.fromCanonAddress(receiver),
      nonce: this.signer.generateNewNonce(nullifierB),
      asset: oldNoteA.asset,
      id: oldNoteA.id,
      value: paymentValue,
    };

    const newNoteACommitment = NoteTrait.toCommitment(newNoteA);
    const newNoteBCommitment = NoteTrait.toCommitment(newNoteB);

    const newNoteATransmission = genNoteTransmission(
      this.signer.privkey.toCanonAddress(),
      newNoteA
    );
    const newNoteBTransmission = genNoteTransmission(receiver, newNoteB);
    const publicSpend =
      oldNoteA.value + oldNoteB.value - refundValue - paymentValue;

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

    return {
      commitmentTreeRoot: merkleProofA.root,
      nullifierA,
      nullifierB,
      newNoteACommitment,
      newNoteATransmission,
      newNoteBCommitment,
      newNoteBTransmission,
      asset: oldNoteA.asset,
      id: oldNoteA.id,
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
   * @param gasLimit:Gas limit
   */
  protected async getPreSignOperation(
    { joinSplitRequests, actions }: OperationRequest,
    tokens: SpendAndRefundTokens,
    refundAddr: NocturneAddress,
    gasLimit = 1_000_000n
  ): Promise<PreSignOperation> {
    // For each asset request, gather necessary notes
    const preSignJoinSplitTxs: Promise<PreSignJoinSplitTx>[] = [];
    for (const rq of joinSplitRequests) {
      let notesToUse = await this.gatherMinimumNotes(rq);
      // Total value of notes in notesToUse
      const totalUsedValue = notesToUse.reduce((s, note) => {
        return s + note.value;
      }, 0n);

      // Compute payment value for this operation (all payment new note values)
      const opPaymentVal = rq.paymentIntent ? rq.paymentIntent.value : 0n;

      // Compute return value for this operation (all returning new note values)
      const opReturnVal = totalUsedValue - rq.value - opPaymentVal;

      // Insert a dummy note if length of notes to use is odd
      if (notesToUse.length % 2 == 1) {
        const newAddr = this.signer.privkey.toCanonAddressStruct();
        notesToUse.push({
          owner: newAddr,
          nonce: 0n,
          asset: notesToUse[0].asset,
          id: notesToUse[0].id,
          value: 0n,
          merkleIndex: 0,
        });
      }

      let noteA, noteB;
      let remainingPaymentVal = opPaymentVal;
      let remainingReturnVal = opReturnVal;
      while (notesToUse.length > 0) {
        [noteA, noteB, ...notesToUse] = notesToUse;

        // Value of newNoteA for this joinsplit
        const currentReturnVal =
          noteA.value + noteB.value >= remainingReturnVal
            ? remainingReturnVal
            : 0n;
        remainingReturnVal -= currentReturnVal;

        // Value of newNoteB for this joinsplit
        const currentPaymentVal =
          noteA.value + noteB.value - currentReturnVal >= remainingPaymentVal
            ? remainingPaymentVal
            : 0n;
        remainingPaymentVal -= currentPaymentVal;

        preSignJoinSplitTxs.push(
          this.genPreSignJoinSplitTx(
            noteA,
            noteB,
            currentReturnVal,
            currentPaymentVal,
            rq.paymentIntent ? rq.paymentIntent.receiver : undefined
          )
        );
      }
    }
    return {
      joinSplitTxs: await Promise.all(preSignJoinSplitTxs),
      refundAddr,
      tokens,
      actions,
      gasLimit,
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
      oldNoteA: NoteTrait.toNoteInput(oldNoteA),
      oldNoteB: NoteTrait.toNoteInput(oldNoteB),
      merkleProofA: merkleInputA,
      merkleProofB: merkleInputB,
      newNoteA: NoteTrait.toNoteInput(newNoteA),
      newNoteB: NoteTrait.toNoteInput(newNoteB),
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
    let totalVal = joinSplitRequest.value;
    if (joinSplitRequest.paymentIntent !== undefined) {
      totalVal += joinSplitRequest.paymentIntent.value;
    }
    const balance = await this.getAssetBalance(joinSplitRequest.asset);
    if (balance < totalVal) {
      throw new Error(
        `Attempted to spend more funds than owned. Address: ${joinSplitRequest.asset.address}. Attempted: ${joinSplitRequest.value}. Owned: ${balance}.`
      );
    }
  }

  /**
   * Gather minimum list of notes required to fulfill asset request. Returned
   * list is sorted from smallest to largest. The total value of returned notes
   * could exceed the requested amount.
   *
   * @param joinSplitRequest request
   * @return a list of included notes to spend the total value.
   */
  async gatherMinimumNotes(
    joinSplitRequest: JoinSplitRequest
  ): Promise<IncludedNote[]> {
    this.ensureMinimumForAssetRequest(joinSplitRequest);
    let totalVal = joinSplitRequest.value;
    if (joinSplitRequest.paymentIntent !== undefined) {
      totalVal += joinSplitRequest.paymentIntent.value;
    }

    const notes = await this.db.getNotesFor(joinSplitRequest.asset);
    const sortedNotes = [...notes].sort((a, b) => {
      return Number(a.value - b.value);
    });

    const notesToUse: IncludedNote[] = [];
    let totalSpend = 0n;
    while (totalSpend < totalVal) {
      const oldNote = sortedNotes.shift()!;
      notesToUse.push(oldNote);
      totalSpend += oldNote.value;
    }

    return notesToUse;
  }

  /**
   * Generte an operation request for a payment
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
          value: 0n,
          paymentIntent: {
            receiver,
            value,
          },
        },
      ],
      refundTokens: [],
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
      const asset = NocturneDB.parseNotesKey(assetString);
      const balance = BigInt(notes.reduce((a, b) => a + Number(b.value), 0));
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
      return BigInt(notes.reduce((a, b) => a + Number(b.value), 0));
    }
  }
}
