import { Address, AssetRequest, AssetStruct } from "./commonTypes";
import {
  Action,
  PostProofOperation,
  PostProofSpendTransaction,
  PreProofOperation,
  PreProofSpendTransaction,
  Tokens,
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
import { MerkleProver } from "./sdk/merkleProver";
import { FlaxDB, LocalFlaxDB } from "./sdk/db";
import { NotesManager } from "./sdk";

export interface OperationRequest {
  assetRequests: AssetRequest[];
  refundTokens: Address[]; // TODO: ensure hardcoded address for no refund tokens
  actions: Action[];
}

export interface OldAndNewNotePair {
  oldNote: IncludedNote;
  newNote: Note;
}

export class FlaxContext {
  signer: FlaxSigner;
  prover: Spend2Prover;
  merkleProver: MerkleProver;
  notesManager: NotesManager;
  db: FlaxDB;

  constructor(
    signer: FlaxSigner,
    prover: Spend2Prover,
    merkleProver: MerkleProver,
    notesManager: NotesManager,
    db: FlaxDB = new LocalFlaxDB()
  ) {
    this.signer = signer;
    this.prover = prover;
    this.merkleProver = merkleProver;
    this.notesManager = notesManager;
    this.db = db;
  }

  /**
   * Attempt to create a `PostProofOperation` provided an `OperationRequest`.
   * `FlaxContext` will attempt to gather all notes to fullfill the operation
   * request's asset requests. It will then generate spend proofs for each and
   * include that in the final `PostProofOperation`.
   *
   * @param assetRequests Asset requested to spend
   * @param refundTokens Details on token Wallet will refund to user
   * @param actions Encoded contract actions to take
   * @param refundAddr Optional refund address. Context will generate
   * rerandomized address if left empty
   * @param gasLimit Gas limit
   */
  async tryCreatePostProofOperation(
    { assetRequests, refundTokens, actions }: OperationRequest,
    refundAddr?: FlaxAddressStruct,
    gasLimit = 1_000_000n
  ): Promise<PostProofOperation> {
    // Generate refund addr if needed
    const realRefundAddr = refundAddr
      ? refundAddr
      : this.signer.address.rerand().toStruct();

    // Create preProofOperation to use in per-note proving
    const tokens: Tokens = {
      spendTokens: assetRequests.map((a) => a.asset.address),
      refundTokens,
    };
    const preProofOperation: PreProofOperation = {
      refundAddr: realRefundAddr,
      tokens,
      actions,
      gasLimit,
    };

    // For each asset request, gather necessary notes
    const allSpendTxPromises: Promise<PostProofSpendTransaction>[] = [];
    for (const assetRequest of assetRequests) {
      const oldAndNewNotePairs = await this.gatherMinimumNotes(
        realRefundAddr,
        assetRequest
      );

      // For each note, generate proof
      for (const oldNewPair of oldAndNewNotePairs) {
        allSpendTxPromises.push(
          this.generatePostProofSpendTx(oldNewPair, preProofOperation)
        );
      }
    }

    const allSpendTxs = await Promise.all(allSpendTxPromises);
    return {
      spendTxs: allSpendTxs,
      refundAddr: realRefundAddr,
      tokens,
      actions,
      gasLimit,
    };
  }

  /**
   * Create a `PostProofSpendTransaction` given the `oldNote`, resulting
   * `newNote`, and operation to use for the `operationDigest`
   *
   * @param oldNewNotePair Old `IncludedNote` and its resulting `newNote`
   * post-spend
   * @param preProofOperation Operation included when generating a proof
   */
  async generatePostProofSpendTx(
    oldNewNotePair: OldAndNewNotePair,
    preProofOperation: PreProofOperation
  ): Promise<PostProofSpendTransaction> {
    const { oldNote, newNote } = oldNewNotePair;
    const nullifier = this.signer.createNullifier(oldNote);
    const newNoteCommitment = newNote.toCommitment();
    const merkleProof = this.merkleProver.getProof(oldNote.merkleIndex);
    const preProofSpendTx: PreProofSpendTransaction = {
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

    const inputs: Spend2Inputs = {
      vk: this.signer.privkey.vk,
      spendPk: this.signer.privkey.spendPk(),
      operationDigest: opDigest,
      c: opSig.c,
      z: opSig.z,
      oldNote: oldNote.toNoteInput(),
      newNote: newNote.toNoteInput(),
      merkleProof: merkleInput,
    };

    const proof = await this.prover.proveSpend2(inputs);
    if (!(await this.prover.verifySpend2Proof(proof))) {
      throw new Error("Proof invalid!");
    }

    const publicSignals = publicSignalsArrayToTyped(proof.publicSignals);
    const solidityProof = packToSolidityProof(proof.proof);
    return {
      commitmentTreeRoot: publicSignals.anchor,
      nullifier,
      newNoteCommitment,
      proof: solidityProof,
      asset: preProofSpendTx.asset,
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
