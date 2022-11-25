import { AssetRequest, AssetStruct, OperationRequest } from "./commonTypes";
import {
  ProvenOperation,
  ProvenSpendTx,
  PreProofOperation,
  PreProofSpendTx,
  SpendAndRefundTokens,
} from "./contract/types";
import { Note, IncludedNote } from "./sdk/note";
import { FlaxSigner } from "./sdk/signer";
import { FlaxAddressStruct } from "./crypto/address";
import { SNARK_SCALAR_FIELD } from "./commonTypes";
import { calculateOperationDigest } from "./contract/utils";
import {
  MerkleProofInput,
  Spend2Prover,
  publicSignalsArrayToTyped,
  Spend2Inputs,
} from "./proof/spend2";
import { packToSolidityProof } from "./contract/proof";
import { LocalMerkleProver, MerkleProver } from "./sdk/merkleProver";
import { FlaxDB } from "./sdk/db";
import { NotesManager } from "./sdk";

export interface OldAndNewNotePair {
  oldNote: IncludedNote;
  newNote: Note;
}

export interface PreProofSpendTxInputs {
  oldNewNotePair: OldAndNewNotePair;
  preProofOperation: PreProofOperation;
}

export interface PreProofSpendTxInputsAndProofInputs {
  preProofSpendTxInputs: PreProofSpendTxInputs;
  proofInputs: Spend2Inputs;
}

export class FlaxContext {
  readonly signer: FlaxSigner;
  protected prover: Spend2Prover;
  protected merkleProver: MerkleProver;
  protected notesManager: NotesManager;
  protected db: FlaxDB;

  constructor(
    signer: FlaxSigner,
    prover: Spend2Prover,
    merkleProver: MerkleProver,
    notesManager: NotesManager,
    db: FlaxDB
  ) {
    this.signer = signer;
    this.prover = prover;
    this.merkleProver = merkleProver;
    this.notesManager = notesManager;
    this.db = db;
  }

  async syncNotes(): Promise<void> {
    await this.notesManager.fetchAndStoreNewNotesFromRefunds();
    await this.notesManager.fetchAndApplyNewSpends();
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
   * `FlaxContext` will attempt to gather all notes to fullfill the operation
   * request's asset requests. It will then generate spend proofs for each and
   * include that in the final `ProvenOperation`.
   *
   * @param assetRequests Asset requested to spend
   * @param refundTokens Details on token Wallet will refund to user
   * @param actions Encoded contract actions to take
   * @param refundAddr Optional refund address. Context will generate
   * rerandomized address if left empty
   * @param gasLimit Gas limit
   */
  async tryCreateProvenOperation(
    operationRequest: OperationRequest,
    spend2WasmPath: string,
    spend2ZkeyPath: string,
    refundAddr?: FlaxAddressStruct,
    gasLimit = 1_000_000n
  ): Promise<ProvenOperation> {
    const { assetRequests, refundTokens, actions } = operationRequest;

    // Generate refund addr if needed
    const realRefundAddr = refundAddr
      ? refundAddr
      : this.signer.address.rerand().toStruct();

    // Create preProofOperation to use in per-note proving
    const tokens: SpendAndRefundTokens = {
      spendTokens: assetRequests.map((a) => a.asset.address),
      refundTokens,
    };

    // Get all inputs needed to generate ProvenSpendTxs
    const preProofSpendTxInputs = await this.getPreProofSpendTxInputsMultiple(
      operationRequest,
      tokens,
      realRefundAddr,
      gasLimit
    );

    // Generate proofs for each PreProofSpendTxInputs and format into
    // ProvenSpendTxs
    const allProvenSpendTxPromises: Promise<ProvenSpendTx>[] = [];
    for (const inputs of preProofSpendTxInputs) {
      allProvenSpendTxPromises.push(
        this.generateProvenSpendTxFor(inputs, spend2WasmPath, spend2ZkeyPath)
      );
    }

    const allSpendTxs = await Promise.all(allProvenSpendTxPromises);
    return {
      spendTxs: allSpendTxs,
      refundAddr: realRefundAddr,
      tokens,
      actions,
      gasLimit,
    };
  }

  async tryGetPreProofSpendTxInputsAndProofInputs(
    operationRequest: OperationRequest,
    refundAddr?: FlaxAddressStruct,
    gasLimit = 1_000_000n
  ): Promise<PreProofSpendTxInputsAndProofInputs[]> {
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

    const spendTxInputsArray = await this.getPreProofSpendTxInputsMultiple(
      operationRequest,
      tokens,
      realRefundAddr,
      gasLimit
    );

    return Promise.all(
      spendTxInputsArray.map(async (spendTxInputs) => {
        const proofInputs = await this.getProofInputsFor(spendTxInputs);
        return {
          preProofSpendTxInputs: spendTxInputs,
          proofInputs,
        };
      })
    );
  }

  /**
   * Given a set of asset requests, gather the necessary notes to fullfill the
   * requests and format the data into PreProofSpendTxInputs (all inputs needed
   * to generate proof for spend tx and format into ProvenSpendTx).
   *
   * @param assetRequests Asset requested to spend
   * @param actions Encoded contract actions to take
   * @param tokens spend and refund token addresses
   * @param refundAddr Optional refund address. Context will generate
   * rerandomized address if left empty
   * @param gasLimit Gas limit
   */
  protected async getPreProofSpendTxInputsMultiple(
    { assetRequests, actions }: OperationRequest,
    tokens: SpendAndRefundTokens,
    refundAddr: FlaxAddressStruct,
    gasLimit = 1_000_000n
  ): Promise<PreProofSpendTxInputs[]> {
    const preProofOperation: PreProofOperation = {
      refundAddr,
      tokens,
      actions,
      gasLimit,
    };

    // For each asset request, gather necessary notes
    const allPreProofSpendTxInputs: PreProofSpendTxInputs[] = [];
    for (const assetRequest of assetRequests) {
      const oldAndNewNotePairs = await this.gatherMinimumNotes(
        refundAddr,
        assetRequest
      );

      for (const oldNewNotePair of oldAndNewNotePairs) {
        allPreProofSpendTxInputs.push({ oldNewNotePair, preProofOperation });
      }
    }

    return allPreProofSpendTxInputs;
  }

  /**
   * Given a single PreProofSpendTxInputs, create proof inputs for the spend tx.
   *
   * @param preProofSpendTxInputs array of preProofSpendTxInputs
   */
  protected async getProofInputsFor({
    oldNewNotePair,
    preProofOperation,
  }: PreProofSpendTxInputs): Promise<Spend2Inputs> {
    const { oldNote, newNote } = oldNewNotePair;
    const nullifier = this.signer.createNullifier(oldNote);
    const newNoteCommitment = newNote.toCommitment();
    const merkleProof = await this.merkleProver.getProof(oldNote.merkleIndex);
    const preProofSpendTx: PreProofSpendTx = {
      commitmentTreeRoot: merkleProof.root,
      nullifier,
      newNoteCommitment,
      asset: oldNote.asset,
      id: oldNote.id,
      valueToSpend: oldNote.value - newNote.value,
    };

    const opDigest = calculateOperationDigest(
      preProofOperation,
      preProofSpendTx
    );
    const opSig = this.signer.sign(opDigest);

    const merkleInput: MerkleProofInput = {
      path: merkleProof.pathIndices.map((n) => BigInt(n)),
      siblings: merkleProof.siblings,
    };

    return {
      vk: this.signer.privkey.vk,
      spendPk: this.signer.privkey.spendPk(),
      operationDigest: opDigest,
      c: opSig.c,
      z: opSig.z,
      oldNote: oldNote.toNoteInput(),
      newNote: newNote.toNoteInput(),
      merkleProof: merkleInput,
    };
  }

  /**
   * Create a `ProvenSpendTx` given the `oldNote`, resulting
   * `newNote`, and operation to use for the `operationDigest`
   *
   * @param oldNewNotePair Old `IncludedNote` and its resulting `newNote`
   * post-spend
   * @param preProofOperation Operation included when generating a proof
   */
  protected async generateProvenSpendTxFor(
    { oldNewNotePair, preProofOperation }: PreProofSpendTxInputs,
    spend2WasmPath: string,
    spend2ZkeyPath: string
  ): Promise<ProvenSpendTx> {
    const { oldNote, newNote } = oldNewNotePair;
    const nullifier = this.signer.createNullifier(oldNote);
    const newNoteCommitment = newNote.toCommitment();

    const inputs = await this.getProofInputsFor({
      oldNewNotePair,
      preProofOperation,
    });

    const proof = await this.prover.proveSpend2(
      inputs,
      spend2WasmPath,
      spend2ZkeyPath
    );

    const publicSignals = publicSignalsArrayToTyped(proof.publicSignals);
    const solidityProof = packToSolidityProof(proof.proof);
    return {
      commitmentTreeRoot: publicSignals.anchor,
      nullifier,
      newNoteCommitment,
      proof: solidityProof,
      asset: oldNewNotePair.oldNote.asset,
      valueToSpend: publicSignals.valueToSpend,
      id: publicSignals.id,
    };
  }

  /**
   * Return minimum list of notes required to fullfill asset request.
   * Returned list is sorted from smallest to largest. The last note in the list
   * may produce a non-zero new note.
   *
   * @param assetRequest Asset request
   */
  async gatherMinimumNotes(
    refundAddr: FlaxAddressStruct,
    assetRequest: AssetRequest
  ): Promise<OldAndNewNotePair[]> {
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

    const oldAndNewNotePairs: OldAndNewNotePair[] = [];
    let totalSpend = 0n;
    while (totalSpend < assetRequest.value) {
      const oldNote = sortedNotes.shift()!;
      totalSpend += oldNote.value;

      const randNonce = BigInt(
        Math.floor(Math.random() * Number(SNARK_SCALAR_FIELD))
      );
      let newNoteValue;
      if (totalSpend > assetRequest.value) {
        newNoteValue = totalSpend - assetRequest.value;
      } else {
        newNoteValue = 0n; // spend whole note
      }

      const newNote = new Note({
        owner: refundAddr,
        nonce: randNonce,
        asset: assetRequest.asset.address,
        id: assetRequest.asset.id,
        value: newNoteValue,
      });

      oldAndNewNotePairs.push({
        oldNote: new IncludedNote(oldNote),
        newNote,
      });
    }

    return oldAndNewNotePairs;
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
