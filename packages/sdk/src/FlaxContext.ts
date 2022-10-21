import { Address, Asset, AssetRequest } from "./commonTypes";
import {
  Action,
  PostProofOperation,
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
  tokenToNotes: Map<Asset, SpendableNote[]>; // notes sorted great to least value
  noteCommitmentTree: BinaryPoseidonTree;
  dbPath: string = "/flaxdb";

  // TODO: pull spendable notes from db
  // TODO: sync tree with db events and new on-chain events
  constructor(privkey: FlaxPrivKey) {
    this.signer = new FlaxSigner(privkey);
    this.tokenToNotes = new Map();
    this.noteCommitmentTree = new BinaryPoseidonTree();
  }

  // TODO: sync owned notes from chain or bucket
  async sync() {}

  async tryFormatOperation(
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
      spendTokens: assetRequests.map((a) => a.address),
      refundTokens,
    };
    const preProofOperation: PreProofOperation = {
      refundAddr: realRefundAddr,
      tokens,
      actions,
      gasLimit,
    };

    for (const assetRequest of assetRequests) {
      const oldAndNewNotePairs = this.gatherMinimumNotes(
        realRefundAddr,
        assetRequest
      );
      for (const oldNewPair of oldAndNewNotePairs) {
        const { oldNote, newNote } = oldNewPair;
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
      }
    }

    /*
      - Generate a refundAddr if parameter empty
      - Create PreProofOperation with refundAddr, request.tokens, request.actions, and gas limit

      For each asset request:
      - Check totalBalances[request.asset] < request.value
      - Gather smallest notes first until you reach threshold > request.value
      - For each oldNote:
          - Create nullifier
          - Generate newNote + newNoteCommitment based on difference of notes -
          request.value
          - Create PreProofSpendTransaction
          - Calculate AND sign operation digest with PreProofSpendTransaction + PreProofOperation
          - Generate proof using vk, spendPk, operationDigest, c, z, oldNote, newNote, and oldNote.merkleProof
      */
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
    const balance = this.getAssetBalance(assetRequest as Asset);
    if (balance < assetRequest.value) {
      throw new Error(
        `Attempted to spend more funds than owned. Address: ${assetRequest.address}. Attempted: ${assetRequest.value}. Owned: ${balance}.`
      );
    }

    const sortedNotes = this.tokenToNotes
      .get(assetRequest as Asset)!
      .sort((a, b) => {
        return Number(a.value - b.value);
      });

    let oldAndNewNotePairs: OldAndNewNotePair[] = [];
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
        asset: assetRequest.address,
        id: assetRequest.id,
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
    const notes = this.tokenToNotes.get(asset);

    if (!notes) {
      return 0n;
    } else {
      return BigInt(notes.reduce((a, b) => a + Number(b.value), 0));
    }
  }
}
