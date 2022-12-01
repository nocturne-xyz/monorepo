import { AssetRequest, AssetStruct, OperationRequest } from "./commonTypes";
import {
  PreSignJoinSplitTx,
  PreProofJoinSplitTx,
  ProvenJoinSplitTx,
  PreSignOperation,
  PreProofOperation,
  ProvenOperation,
  SpendAndRefundTokens,
} from "./contract/types";
import { Note, IncludedNote } from "./sdk/note";
import { NocturneSigner, NocturneSignature } from "./sdk/signer";
import { NocturneAddressStruct, NocturneAddress } from "./crypto/address";
import { calculateOperationDigest } from "./contract/utils";
import {
  JoinSplitProver,
  JoinSplitInputs,
  joinSplitPublicSignalsArrayToTyped,
} from "./proof/joinsplit";
import { packToSolidityProof } from "./contract/proof";
import { LocalMerkleProver, MerkleProver } from "./sdk/merkleProver";
import { NocturneDB } from "./sdk/db";
import { NotesManager } from "./sdk";
import { MerkleProofInput } from "./proof";
import { poseidon } from "circomlibjs";

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
  protected db: NocturneDB;

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
   * `NocturneContext` will attempt to gather all notes to fullfill the operation
   * request's asset requests. It will then generate spend proofs for each and
   * include that in the final `ProvenOperation`.
   *
   * @param OperationRequest Asset requested to spend
   * @param joinSplit{Wasm,Zkey}Path paths to circuit runtime and prooving key
   * @param refundAddr Optional refund address. Context will generate
   * rerandomized address if left empty
   * @param gasLimit Gas limit
   */
  async tryCreateProvenOperation(
    operationRequest: OperationRequest,
    joinSplitWasmPath: string,
    joinSplitZkeyPath: string,
    refundAddr?: NocturneAddressStruct,
    gasLimit = 1_000_000n
  ): Promise<ProvenOperation> {
    const preProofOp: PreProofOperation = await this.tryGetPreProofOperation(
      operationRequest,
      refundAddr,
      gasLimit
    );

    const allProofPromises: Promise<ProvenJoinSplitTx>[] = preProofOp.joinSplitTxs.map((tx) => {
      return this.proveJoinSplitTx(
        tx,
        joinSplitWasmPath,
        joinSplitZkeyPath);
    });

    return {
      joinSplitTxs: await Promise.all(allProofPromises),
      refundAddr: preProofOp.refundAddr,
      tokens: preProofOp.tokens,
      actions: preProofOp.actions,
      gasLimit: preProofOp.gasLimit,
    };
  }

  async tryGetPreProofOperation(
    operationRequest: OperationRequest,
    refundAddr?: NocturneAddressStruct,
    gasLimit = 1_000_000n
  ): Promise<PreProofOperation> {
    const { assetRequests, refundTokens } = operationRequest;

    // Generate refund addr if needed
    const realRefundAddr = refundAddr
      ? refundAddr
      : this.signer.address.rerand().toStruct();

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
    }));

    return {
      joinSplitTxs: preProofJoinSplitTxs,
      refundAddr: preSignOperation.refundAddr,
      tokens: preSignOperation.tokens,
      actions: preSignOperation.actions,
      gasLimit: preSignOperation.gasLimit,
    };
  }

  /**
   * Generate a `ProvenJoinSplitTx`
   *
   * @param oldNewNotePair Old `IncludedNote` and its resulting `newNote`
   * post-spend
   * @param preProofOperation Operation included when generating a proof
   */
  protected async proveJoinSplitTx(
    preProofJoinSplitTx: PreProofJoinSplitTx,
    joinSplitWasmPath: string,
    joinSplitZkeyPath: string
  ): Promise<ProvenJoinSplitTx> {
    const {
      opDigest,
      proofInputs,
      ...baseJoinSplitTx
    } = preProofJoinSplitTx;
    const proof = await this.prover.proveJoinSplit(
      proofInputs,
      joinSplitWasmPath,
      joinSplitZkeyPath
    );

    // Check that snarkjs output is consistent with our precomputed joinsplit values
    const publicSignals = joinSplitPublicSignalsArrayToTyped(proof.publicSignals);
    if ( (baseJoinSplitTx.newNoteACommitment != publicSignals.newNoteACommitment) ||
      (baseJoinSplitTx.newNoteBCommitment != publicSignals.newNoteBCommitment) ||
      (baseJoinSplitTx.commitmentTreeRoot != publicSignals.commitmentTreeRoot) ||
      (baseJoinSplitTx.publicSpend != publicSignals.publicSpend) ||
      (baseJoinSplitTx.nullifierA != publicSignals.nullifierA) ||
      (baseJoinSplitTx.nullifierB != publicSignals.nullifierB) ||
      (baseJoinSplitTx.nullifierB != publicSignals.nullifierB) ||
      (BigInt(baseJoinSplitTx.asset) != publicSignals.asset) ||
      (baseJoinSplitTx.id != publicSignals.id) ||
      (opDigest != publicSignals.opDigest)
    ) {
      throw new Error( `SnarkJS generated public input differs from precomputed ones.`);
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
   * @param receiverAddr recipient of confidential payment
   * @param outGoingValue value of confidential payment
   */
  protected async genPreSignJoinSplitTx(
    oldNoteA: IncludedNote,
    oldNoteB: IncludedNote,
    refundValue: bigint,
    outGoingValue = 0n,
    receiverAddr?: NocturneAddress,
  ): Promise<PreSignJoinSplitTx> {
    const nullifierA = this.signer.createNullifier(oldNoteA);
    const nullifierB = this.signer.createNullifier(oldNoteB);
    const newNoteAOwner = this.signer.privkey.toCanonAddressStruct();
    const newNoteBOwner = newNoteAOwner;
    const newNoteA = new Note({
      owner: newNoteAOwner,
      nonce: poseidon([this.signer.privkey.vk, nullifierA]),
      asset: oldNoteA.asset,
      id: oldNoteA.id,
      value: refundValue,
    });
    const [,[encappedKeyA], encryptedNoteA] = this.signer.encryptNote([this.signer.canonAddress], newNoteA);
    const newNoteB = new Note({
      owner: newNoteBOwner,
      nonce: poseidon([this.signer.privkey.vk, nullifierB]),
      asset: oldNoteA.asset,
      id: oldNoteA.id,
      value: 0n,
    });
    const [,[encappedKeyB], encryptedNoteB] = this.signer.encryptNote([this.signer.canonAddress], newNoteB);
    const newNoteACommitment = newNoteA.toCommitment();
    const newNoteBCommitment = newNoteB.toCommitment();
    const publicSpend = oldNoteA.value + oldNoteB.value - refundValue - outGoingValue;

    const merkleProofA = await this.merkleProver.getProof(oldNoteA.merkleIndex);
    const merkleInputA: MerkleProofInput = {
      path: merkleProofA.pathIndices.map((n) => BigInt(n)),
      siblings: merkleProofA.siblings,
    };

    let merkleInputB;

    if (oldNoteB.value != 0n) {
      const merkleProofB = await this.merkleProver.getProof(oldNoteB.merkleIndex);
      merkleInputB = {
        path: merkleProofB.pathIndices.map((n) => BigInt(n)),
        siblings: merkleProofB.siblings,
      };
    } else { // Note B is dummy. Any input works here
      merkleInputB = merkleInputA;
    }

    return {
      commitmentTreeRoot: merkleProofA.root,
      nullifierA,
      nullifierB,
      newNoteACommitment,
      newNoteAOwner,
      encappedKeyA,
      encryptedNoteA,
      newNoteBCommitment,
      newNoteBOwner,
      encappedKeyB,
      encryptedNoteB,
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
   * Given a set of asset requests, gather the necessary notes to
   * fulfill the requests and format the data into PreSignOpeartion
   * (all data needed to compute opeartionDigest).
   *
   * @param assetRequests Asset requested to spend
   * @param actions Encoded contract actions to take
   * @param tokens spend and refund token addresses
   * @param refundAddr Optional refund address. Context will generate
   * rerandomized address if left empty
   * @param gasLimit Gas limit
   */
  protected async getPreSignOperation(
    { assetRequests, actions }: OperationRequest,
    tokens: SpendAndRefundTokens,
    refundAddr: NocturneAddressStruct,
    gasLimit = 1_000_000n
  ): Promise<PreSignOperation> {
    // For each asset request, gather necessary notes
    const preSignJoinSplitTxs: Promise<PreSignJoinSplitTx>[] = [];
    for (const assetRequest of assetRequests) {
      const [notesToUse, totalVal] = await this.gatherMinimumNotes(assetRequest);
      let refundVal = totalVal - assetRequest.value;
      if (notesToUse.length % 2 == 1) {
          const newAddr = this.signer.privkey.toCanonAddressStruct();
          notesToUse.push(new IncludedNote({
            owner: newAddr,
            nonce: 0n,
            asset: notesToUse[0].asset,
            id: notesToUse[0].id,
            value: 0n,
            merkleIndex: 0,
          }));
      }
      for (let i = 0; i < notesToUse.length / 2; i++) {
        let val = 0n;
        if (notesToUse[i].value + notesToUse[i].value > refundVal) {
          val = refundVal;
          refundVal = 0n;
        }
        preSignJoinSplitTxs.push(this.genPreSignJoinSplitTx(
          notesToUse[i],
          notesToUse[i+1],
          val
        ));
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
   * Given two included notes and intended transaction semantics,
   * generate inputs to the joinsplit circuit
   *
   * @param oldNoteA, oldNoteB old notes to spend
   * @param refundValue value to be given back to the spender
   * @param opDigest
   * @param opSig
   * @param receiverAddr recipient of confidential payment
   * @param outGoingValue value of confidential payment
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
      oldNoteA: oldNoteA.toNoteInput(),
      oldNoteB: oldNoteB.toNoteInput(),
      merkleProofA: merkleInputA,
      merkleProofB: merkleInputB,
      newNoteA: newNoteA.toNoteInput(),
      newNoteB: newNoteB.toNoteInput(),
    };

    return {
      opDigest,
      proofInputs,
      ...baseJoinSplitTx,
    };
  }

  /**
   * Gather minimum list of notes required to fulfill asset request.
   * Returned list is sorted from smallest to largest.
   * The total value of returned notes could exceed the requested
   * amount.
   *
   * @param assetRequest Asset request
   * @return a list of included notes to spend the total value.
   */
  async gatherMinimumNotes(
    assetRequest: AssetRequest
  ): Promise<[IncludedNote[], bigint]> {
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
      notesToUse.push(new IncludedNote(oldNote));
      totalSpend += oldNote.value;
    }

    return [notesToUse, totalSpend];
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
