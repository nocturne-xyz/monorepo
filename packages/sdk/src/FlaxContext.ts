import { Address, Asset, AssetHash, AssetRequest } from "./commonTypes";
import {
  Action,
  PostProofOperation,
  PostProofSpendTransaction,
  PreProofOperation,
  PreProofSpendTransaction,
  Tokens,
} from "./contract/types";
import { Note, SpendableNote } from "./sdk/note";
import { BinaryPoseidonTree } from "./primitives/binaryPoseidonTree";
import { FlaxSigner } from "./sdk/signer";
import { FlaxPrivKey } from "./crypto/privkey";
import { FlattenedFlaxAddress } from "./crypto/address";
import { SNARK_SCALAR_FIELD } from "./proof/common";
import { calculateOperationDigest } from "./contract/utils";
import {
  MerkleProofInput,
  proveSpend2,
  publicSignalsArrayToTyped,
  Spend2Inputs,
  verifySpend2Proof,
} from "./proof/spend2";
import { packToSolidityProof } from "./contract/proof";

export interface OperationRequest {
  assetRequests: AssetRequest[];
  refundTokens: Address[]; // TODO: ensure hardcoded address for no refund tokens
  actions: Action[];
}

export interface OldAndNewNotePair {
  oldNote: SpendableNote;
  newNote: Note;
}

export class FlaxContext {
  signer: FlaxSigner;
  tokenToNotes: Map<AssetHash, SpendableNote[]>; // notes sorted great to least value
  noteCommitmentTree: BinaryPoseidonTree;
  dbPath = "/flaxdb";

  // TODO: pull spendable notes from db
  // TODO: sync tree with db events and new on-chain events
  // TODO: remove tokenToNotes and noteCommitmentTree, only for testing purposes!
  constructor(
    privkey: FlaxPrivKey,
    tokenToNotes: Map<AssetHash, SpendableNote[]>,
    noteCommitmentTree: BinaryPoseidonTree
  ) {
    this.signer = new FlaxSigner(privkey);
    this.tokenToNotes = tokenToNotes;
    this.noteCommitmentTree = noteCommitmentTree;
  }

  // TODO: sync owned notes from chain or bucket
  // async sync() {}

  async tryCreatePostProofOperation(
    { assetRequests, refundTokens, actions }: OperationRequest,
    refundAddr?: FlattenedFlaxAddress,
    gasLimit = 1_000_000n
  ): Promise<PostProofOperation> {
    // Generate refund addr if needed
    const realRefundAddr = refundAddr
      ? refundAddr
      : this.signer.address.rerand().toFlattened();

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
      const oldAndNewNotePairs = this.gatherMinimumNotes(
        realRefundAddr,
        assetRequest
      );

      console.log("Minimum notes: ", oldAndNewNotePairs);

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

  async generatePostProofSpendTx(
    oldNewNotePair: OldAndNewNotePair,
    preProofOperation: PreProofOperation
  ): Promise<PostProofSpendTransaction> {
    const { oldNote, newNote } = oldNewNotePair;
    const nullifier = this.signer.createNullifier(oldNote as Note);
    const newNoteCommitment = newNote.toCommitment();
    const preProofSpendTx: PreProofSpendTransaction = {
      commitmentTreeRoot: oldNote.merkleProof.root,
      nullifier,
      newNoteCommitment,
      asset: oldNote.asset,
      id: oldNote.id,
      value: oldNote.value - newNote.value,
    };

    const opDigest = calculateOperationDigest(
      preProofOperation,
      preProofSpendTx
    );
    const opSig = this.signer.sign(opDigest);

    const merkleInput: MerkleProofInput = {
      path: oldNote.merkleProof.pathIndices.map((n) => BigInt(n)),
      siblings: oldNote.merkleProof.siblings,
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

    const proof = await proveSpend2(inputs);
    if (!(await verifySpend2Proof(proof))) {
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
      value: publicSignals.value,
      id: publicSignals.id,
    };
  }

  /**
   * Gather minimum list of notes required to fullfill asset request. Returned
   * list is sorted from smallest to largest. The last note in the list may
   * produce a non-zero new note.
   *
   * @param assetRequest asset request
   */
  gatherMinimumNotes(
    refundAddr: FlattenedFlaxAddress,
    assetRequest: AssetRequest
  ): OldAndNewNotePair[] {
    const balance = this.getAssetBalance(assetRequest.asset);
    if (balance < assetRequest.value) {
      throw new Error(
        `Attempted to spend more funds than owned. Address: ${assetRequest.asset.address}. Attempted: ${assetRequest.value}. Owned: ${balance}.`
      );
    }

    const sortedNotes = this.tokenToNotes
      .get(assetRequest.asset.hash())!
      .sort((a, b) => {
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
        oldNote,
        newNote,
      });
    }

    return oldAndNewNotePairs;
  }

  getAssetBalance(asset: Asset): bigint {
    const notes = this.tokenToNotes.get(asset.hash());

    if (!notes) {
      return 0n;
    } else {
      return BigInt(notes.reduce((a, b) => a + Number(b.value), 0));
    }
  }
}
