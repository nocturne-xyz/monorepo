import { Address, AssetRequest, AssetStruct } from "./commonTypes";
import {
  Action,
  PostProofOperation,
  PostProofJoinsplitTransaction,
  PreProofOperation,
  PreProofJoinsplitTransaction,
  Tokens,
} from "./contract/types";
import { Note, IncludedNote } from "./sdk/note";
import { Signer, Signature } from "./sdk/signer";
import { AnonAddressStruct } from "./crypto/address";
import { SNARK_SCALAR_FIELD } from "./commonTypes";
import { calculateOperationDigest } from "./contract/utils";
// import {
//   MerkleProofInput,
//   proveSpend2,
//   publicSignalsArrayToTyped,
//   Spend2Inputs,
//   verifySpend2Proof,
// } from "./proof/spend2";
import {
  MerkleProofInput,
  proveJoinsplit,
  publicSignalsArrayToTyped,
  JoinsplitInputs,
  verifyJoinsplitProof,
} from "./proof/joinsplit";
import { packToSolidityProof } from "./contract/proof";
import { MerkleProver } from "./sdk/merkleProver";
import { FlaxDB, FlaxLMDB } from "./sdk/db";
import { NotesManager } from "./sdk";

export interface OperationRequest {
  assetRequests: AssetRequest[];
  refundTokens: Address[]; // TODO: ensure hardcoded address for no refund tokens
  actions: Action[];
}

export class FlaxContext {
  signer: Signer;
  merkleProver: MerkleProver;
  notesManager: NotesManager;
  db: FlaxDB;

  constructor(
    signer: Signer,
    merkleProver: MerkleProver,
    notesManager: NotesManager,
    db: FlaxDB = new FlaxLMDB()
  ) {
    this.signer = signer;
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
    refundAddr?: AnonAddressStruct,
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

    const allPreProofJoinsplitTxs: PreProofJoinsplitTransaction[] = [];
    const allJoinsplitInputs: JoinsplitInputs[] = [];

    // For each asset request, gather necessary notes
    for (const assetRequest of assetRequests) {
      const [oldNotes, newNotes] = this.gatherMinimumNotes(
        realRefundAddr,
        assetRequest
      );

      console.log(oldNotes, newNotes);

      // for (const oldNewPair of oldAndNewNotes) {
      //   const [tx, proofInput] = generatePreProofJoinsplitTx(oldNoteA, oldNoteB, newNoteA, newNoteB);
      //   allPreProofJoinsplitTxs.push(tx);
      //   allJoinsplitInputs.push(proofInput);
      // }
    }

    const preProofOperation: PreProofOperation = {
      joinsplitTxs: allPreProofJoinsplitTxs,
      refundAddr: realRefundAddr,
      tokens,
      actions,
      gasLimit,
    };

    // generate OperationDigest
    const opDigest = calculateOperationDigest(preProofOperation);
    // sign the digest
    const opSig = this.signer.sign(opDigest);

    const allJoinsplitTxPromises: Promise<PostProofJoinsplitTransaction>[] = [];
    for (const input of allJoinsplitInputs) {
      input.operationDigest = opDigest;
      allJoinsplitTxPromises.push(this.generatePostProofJoinsplitTx(input, opSig));
    }

    const allJoinsplitTxs = await Promise.all(allJoinsplitTxPromises);

    return {
      joinsplitTxs: allJoinsplitTxs,
      refundAddr: realRefundAddr,
      tokens,
      actions,
      gasLimit,
    };
  }

  /**
   * Create a `PreProofJoinsplitTransaction` given the `oldNoteA, oldNoteB`,
   * resulting `newNoteA, newNoteB`
   */
  generatePreProofJoinsplitTx(
    oldNoteA: IncludedNote,
    oldNoteB: IncludedNote,
    newNoteA: Note,
    newNoteB: Note
  ): [JoinsplitInputs, PreProofJoinsplitTransaction] {
    const nullifierA = this.signer.createNullifier(oldNoteA);
    const nullifierB = this.signer.createNullifier(oldNoteB);
    const newNoteACommitment = newNoteA.toCommitment();
    const newNoteBCommitment = newNoteB.toCommitment();
    const merkleProofA = this.merkleProver.getProof(oldNoteA.merkleIndex);
    const merkleProofB = this.merkleProver.getProof(oldNoteB.merkleIndex);

    const publicSpend = oldNoteA.value + oldNoteA.value - newNoteA.value - newNoteB.value;

    const merkleInputA: MerkleProofInput = {
      path: merkleProofA.pathIndices.map((n) => BigInt(n)),
      siblings: merkleProofA.siblings,
    };
    const merkleInputB: MerkleProofInput = {
      path: merkleProofB.pathIndices.map((n) => BigInt(n)),
      siblings: merkleProofB.siblings,
    };

    const inputs: JoinsplitInputs = {
      vk: this.signer.privkey.vk,
      spendPk: this.signer.privkey.spendPk(),
      operationDigest: BigInt(0), //
      c: BigInt(0), //
      z: BigInt(0), //
      oldNoteA: oldNoteA.toNoteInput(),
      oldNoteB: oldNoteB.toNoteInput(),
      newNoteA: newNoteA.toNoteInput(),
      newNoteB: newNoteB.toNoteInput(),
      merkleProofA: merkleInputA,
      merkleProofB: merkleInputB,
    };

    const preProofJoinsplitTx: PreProofJoinsplitTransaction = {
      commitmentTreeRoot: merkleProofA.root,
      nullifierA,
      nullifierB,
      newNoteACommitment,
      newNoteBCommitment,
      asset: oldNoteA.asset,
      id: oldNoteA.id,
      publicSpend,
    };

    return [inputs, preProofJoinsplitTx]
  }

  /**
   * Create a `PostProofJoinsplitTransaction` given the `oldNote`, resulting
   * `newNote`, and operation to use for the `operationDigest`
   *
   * @param proofInputs preproof joinsplit inptus with empty opSig
   * @param preProofOperation Operation included when generating a proof
   */
  async generatePostProofJoinsplitTx(
    proofInputs: JoinsplitInputs,
    opSig: Signature
  ): Promise<PostProofJoinsplitTransaction> {
    proofInputs.c = opSig.c;
    proofInputs.z = opSig.z;

    const proof = await proveJoinsplit(proofInputs);
    if (!(await verifyJoinsplitProof(proof))) {
      throw new Error("Proof invalid!");
    }

    const publicSignals = publicSignalsArrayToTyped(proof.publicSignals);
    const solidityProof = packToSolidityProof(proof.proof);
    return {
      commitmentTreeRoot: publicSignals.anchor,
      nullifierA: publicSignals.nullifierA,
      nullifierB: publicSignals.nullifierB,
      newNoteACommitment: publicSignals.newNoteACommitment,
      newNoteBCommitment: publicSignals.newNoteBCommitment,
      proof: solidityProof,
      asset: String(publicSignals.asset),
      publicSpend: publicSignals.publicSpend,
      id: publicSignals.id,
    };
  }

  /**
   * Return minimum list of notes required to fullfill asset request.
   * Returned list is sorted from smallest to largest. The last note in the list
   * may produce a non-zero new note.
   *
   * @param refundAddr
   * @param assetRequest Asset request
   * @return (oldNotes, newNotes) list of notes to spent and a single
   */
  gatherMinimumNotes(
    refundAddr: AnonAddressStruct,
    assetRequest: AssetRequest
  ): [IncludedNote[], Note[]] {
    const balance = this.getAssetBalance(assetRequest.asset);
    if (balance < assetRequest.value) {
      throw new Error(
        `Attempted to spend more funds than owned. Address: ${assetRequest.asset.address}. Attempted: ${assetRequest.value}. Owned: ${balance}.`
      );
    }

    const notes = this.db.getNotesFor(assetRequest.asset);
    const sortedNotes = notes.sort((a, b) => {
      return Number(a.value - b.value);
    });

    const oldNotes: IncludedNote[] = [];
    const newNotes: Note[] = [];
    let totalSpend = 0n;
    while (totalSpend < assetRequest.value) {
      const oldNote = sortedNotes.shift()!;
      totalSpend += oldNote.value;
      oldNotes.push(new IncludedNote(oldNote));
    }

    if (totalSpend > assetRequest.value) {
      const randNonce = BigInt(
        Math.floor(Math.random() * Number(SNARK_SCALAR_FIELD))
      );
      const newNoteValue = totalSpend - assetRequest.value;
      const newNote = new Note({
        owner: refundAddr,
        nonce: randNonce,
        asset: assetRequest.asset.address,
        id: assetRequest.asset.id,
        value: newNoteValue,
      });
      newNotes.push(newNote);
    }

    return [oldNotes.reverse(), newNotes];
  }

  /**
   * Sum up the note values for a given `tokenToNote` entry array.
   *
   * @param asset Asset
   */
  getAssetBalance(asset: AssetStruct): bigint {
    const notes = this.db.getNotesFor(asset);

    if (!notes) {
      return 0n;
    } else {
      return BigInt(notes.reduce((a, b) => a + Number(b.value), 0));
    }
  }
}
