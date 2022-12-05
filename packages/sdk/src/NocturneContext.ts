import {
  AssetRequest,
  AssetStruct,
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
import { NocturneAddress, NocturneAddressTrait } from "./crypto/address";
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
    const { assetRequests, refundTokens } = operationRequest;

    // Generate refund addr if needed
    const realRefundAddr = refundAddr
      ? refundAddr
      : NocturneAddressTrait.rerandNocturneAddress(this.signer.address);

    // Create preProofOperation to use in per-note proving
    const tokens: SpendAndRefundTokens = {
      spendTokens: assetRequests.map((a) => a.asset.address),
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
   * @param assetRequests Asset requests
   */
  async ensureMinimumForOperationRequest({
    assetRequests,
  }: OperationRequest): Promise<void> {
    for (const assetRequest of assetRequests) {
      await this.ensureMinimumForAssetRequest(assetRequest);
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
   * @param outGoingValue value of confidential payment
   * @param receiverAddr recipient of confidential payment
   * @return a PreSignJoinSplitTx
   */
  protected async genPreSignJoinSplitTx(
    oldNoteA: IncludedNote,
    oldNoteB: IncludedNote,
    refundValue: bigint,
    outGoingValue = 0n // TODO: add back receiverAddr for confidential payments
  ): Promise<PreSignJoinSplitTx> {
    const nullifierA = this.signer.createNullifier(oldNoteA);
    const nullifierB = this.signer.createNullifier(oldNoteB);

    const newNoteAOwner = this.signer.privkey.toCanonAddressStruct();
    const newNoteBOwner = newNoteAOwner;

    const newNoteA: Note = {
      owner: newNoteAOwner,
      nonce: this.signer.generateNewNonce(nullifierA),
      asset: oldNoteA.asset,
      id: oldNoteA.id,
      value: refundValue,
    };
    const newNoteB: Note = {
      owner: newNoteBOwner,
      nonce: this.signer.generateNewNonce(nullifierB),
      asset: oldNoteA.asset,
      id: oldNoteA.id,
      value: 0n,
    };

    const newNoteACommitment = NoteTrait.noteToCommitment(newNoteA);
    const newNoteBCommitment = NoteTrait.noteToCommitment(newNoteB);

    const newNoteATransmission = genNoteTransmission(
      this.signer.privkey.toCanonAddress(),
      newNoteA
    );
    const newNoteBTransmission = genNoteTransmission(
      this.signer.privkey.toCanonAddress(),
      newNoteB
    );
    const publicSpend =
      oldNoteA.value + oldNoteB.value - refundValue - outGoingValue;

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
    { assetRequests, actions }: OperationRequest,
    tokens: SpendAndRefundTokens,
    refundAddr: NocturneAddress,
    gasLimit = 1_000_000n
  ): Promise<PreSignOperation> {
    // For each asset request, gather necessary notes
    const preSignJoinSplitTxs: Promise<PreSignJoinSplitTx>[] = [];
    for (const assetRequest of assetRequests) {
      let notesToUse = await this.gatherMinimumNotes(assetRequest);
      const totalVal = notesToUse.reduce((s, note) => {
        return s + note.value;
      }, 0n);
      let refundVal = totalVal - assetRequest.value;
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
      while (notesToUse.length > 0) {
        [noteA, noteB, ...notesToUse] = notesToUse;
        let val = 0n;
        // add in the refund value if noteA and noteB spend enough
        if (noteA.value + noteB.value > refundVal) {
          val = refundVal;
          refundVal = 0n;
        }
        preSignJoinSplitTxs.push(this.genPreSignJoinSplitTx(noteA, noteB, val));
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
      oldNoteA: NoteTrait.noteToNoteInput(oldNoteA),
      oldNoteB: NoteTrait.noteToNoteInput(oldNoteB),
      merkleProofA: merkleInputA,
      merkleProofB: merkleInputB,
      newNoteA: NoteTrait.noteToNoteInput(newNoteA),
      newNoteB: NoteTrait.noteToNoteInput(newNoteB),
    };

    return {
      opDigest,
      proofInputs,
      ...baseJoinSplitTx,
    };
  }

  /**
   * Ensure user has balances to fullfill `assetRequest`. Throws error if
   * attempted request exceeds owned balance.
   *
   * @param assetRequest Asset request
   */
  async ensureMinimumForAssetRequest(
    assetRequest: AssetRequest
  ): Promise<void> {
    const balance = await this.getAssetBalance(assetRequest.asset);
    if (balance < assetRequest.value) {
      throw new Error(
        `Attempted to spend more funds than owned. Address: ${assetRequest.asset.address}. Attempted: ${assetRequest.value}. Owned: ${balance}.`
      );
    }
  }

  /**
   * Gather minimum list of notes required to fulfill asset request. Returned
   * list is sorted from smallest to largest. The total value of returned notes
   * could exceed the requested amount.
   *
   * @param assetRequest Asset request
   * @return a list of included notes to spend the total value.
   */
  async gatherMinimumNotes(
    assetRequest: AssetRequest
  ): Promise<IncludedNote[]> {
    const balance = await this.getAssetBalance(assetRequest.asset);
    if (balance < assetRequest.value) {
      throw new Error(
        `Attempted to spend more funds than owned. Address: ${assetRequest.asset.address}. Attempted: ${assetRequest.value}. Owned: ${balance}.`
      );
    }

    const notes = await this.db.getNotesFor(assetRequest.asset);
    const sortedNotes = [...notes].sort((a, b) => {
      return Number(a.value - b.value);
    });

    const notesToUse: IncludedNote[] = [];
    let totalSpend = 0n;
    while (totalSpend < assetRequest.value) {
      const oldNote = sortedNotes.shift()!;
      notesToUse.push(oldNote);
      totalSpend += oldNote.value;
    }

    return notesToUse;
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
  async getAssetBalance(asset: AssetStruct): Promise<bigint> {
    const notes = await this.db.getNotesFor(asset);

    if (!notes) {
      return 0n;
    } else {
      return BigInt(notes.reduce((a, b) => a + Number(b.value), 0));
    }
  }
}
