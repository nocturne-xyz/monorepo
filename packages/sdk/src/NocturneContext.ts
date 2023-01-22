import {
  JoinSplitRequest,
  Asset,
  AssetWithBalance,
  OperationRequest,
  packToSolidityProof,
  EncodedAsset,
  PreSignJoinSplitTx,
  PreProofJoinSplitTx,
  ProvenJoinSplitTx,
  PreSignOperation,
  PreProofOperation,
  ProvenOperation,
  encodeAsset,
  BLOCK_GAS_LIMIT,
  Address,
} from "./commonTypes";
import { Note, IncludedNote, NoteTrait } from "./sdk/note";
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
import {
  NotesManager,
  getJoinSplitRequestTotalValue,
  fakeProvenOperation,
} from "./sdk";
import { MerkleProofInput } from "./proof";
import { genNoteTransmission } from "./crypto/utils";
import { Handler, Handler__factory } from "@nocturne-xyz/contracts";
import { ethers } from "ethers";
import { OperationResult } from "./contract";

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
  protected handlerContract: Handler;
  readonly db: NotesDB;

  constructor(
    signer: NocturneSigner,
    prover: JoinSplitProver,
    provider: ethers.providers.Provider,
    handlerContractAddress: Address,
    merkleProver: MerkleProver,
    notesManager: NotesManager,
    db: NotesDB
  ) {
    this.signer = signer;
    this.prover = prover;
    this.handlerContract = Handler__factory.connect(
      handlerContractAddress,
      provider
    );
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
   * @param OperationRequest
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
      verificationGasLimit: preProofOp.verificationGasLimit,
      executionGasLimit: preProofOp.executionGasLimit,
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
   * @param operationRequest
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
      verificationGasLimit: preSignOperation.verificationGasLimit,
      executionGasLimit: preSignOperation.executionGasLimit,
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
      baseJoinSplitTx.encodedAsset.encodedAssetAddr !=
        publicSignals.encodedAssetAddr ||
      baseJoinSplitTx.encodedAsset.encodedAssetId !=
        publicSignals.encodedAssetId ||
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
    const encodedAsset = encodeAsset(oldNoteA.asset);

    return {
      commitmentTreeRoot: merkleProofA.root,
      nullifierA,
      nullifierB,
      newNoteACommitment,
      newNoteATransmission,
      newNoteBCommitment,
      newNoteBTransmission,
      encodedAsset,
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
   * Given an operation request, gather the necessary notes to fulfill the
   * requests and format the data into PreSignOperation (all data needed to
   * compute operationDigest).
   *
   * @param operationRequest
   */
  protected async getPreSignOperation({
    joinSplitRequests,
    // Generate refund addr if needed
    refundAddr = NocturneAddressTrait.randomize(this.signer.address),
    refundAssets,
    actions,
    gasPrice = 0n,
    verificationGasLimit = 1_000_000n,
    executionGasLimit,
    maxNumRefunds,
  }: OperationRequest): Promise<PreSignOperation> {
    const preSignJoinSplitTxs: PreSignJoinSplitTx[] = [];
    for (const joinSplitRequest of joinSplitRequests) {
      preSignJoinSplitTxs.push(
        ...(await this.genPreSignJoinSplitTxs(joinSplitRequest))
      );
    }

    const encodedRefundAssets: EncodedAsset[] = refundAssets.map(encodeAsset);

    let simulationRequired = false;
    // Required field absent, need to estimate
    if (!executionGasLimit || !maxNumRefunds) {
      // Set some upper estimates here for executionGasLimit
      executionGasLimit = BLOCK_GAS_LIMIT;
      // TODO: if the default `maxNumRefunds` here is too small and yield an
      // error during simulation, we should programmatically retry and increase
      // it. This is important for large ERC721 or 1155 mints.
      maxNumRefunds =
        BigInt(joinSplitRequests.length + refundAssets.length) + 5n;
      simulationRequired = true;
    }

    const op = {
      joinSplitTxs: preSignJoinSplitTxs,
      refundAddr,
      encodedRefundAssets,
      actions,
      verificationGasLimit,
      executionGasLimit,
      gasPrice,
      maxNumRefunds,
    };

    // Required field absent, need to estimate
    if (simulationRequired) {
      return this.generateGasEstimatedOperation(op);
    } else {
      return op;
    }
  }

  /**
   * Takes input a PreSignOperation and simulate it using connected RPC
   * provider, the operation result is then used rewrite the values of
   * `executionGasLimit` and `maxNumRefunds` for the operation. The rest of the
   * fields for the input operation are unchanged.
   */
  async generateGasEstimatedOperation(
    op: PreSignOperation
  ): Promise<PreSignOperation> {
    console.log("Simulating op");
    const result = await this.simulateOperation(op);
    if (!result.opProcessed) {
      throw Error("Cannot estimate gas with Error: " + result.failureReason);
    }
    // Give 20% over-estimate
    op.executionGasLimit = (result.executionGas * 12n) / 10n;
    // Force set the max number of refunds to the simulated number
    op.maxNumRefunds = result.numRefunds;

    return op;
  }

  /**
   * Simulate an operation getting back OperationResult
   * @param op an operation-ish object
   * @param wallet an ethers instance of the wallet contract
   */
  async simulateOperation(
    op: PreSignOperation | PreProofOperation | ProvenOperation
  ): Promise<OperationResult> {
    // We need to do staticCall, which fails if wallet is connected a signer
    // https://github.com/ethers-io/ethers.js/discussions/3327#discussioncomment-3539505
    // Switching to a regular provider underlying the signer
    let handler = this.handlerContract;
    if (handler.signer) {
      handler = handler.connect(handler.provider);
    }

    // Fill-in the some fake proof
    const provenOp = fakeProvenOperation(op);

    // Set gasPrice to 0 so that gas payment does not interfere with amount of
    // assets unwrapped pre gas estimation
    op.gasPrice = 0n;

    // Set dummy parameters which should not affect operation simulation
    const verificationGasForOp = 0n;
    const bundler = handler.address;

    const walletAddress = await handler._wallet();
    const result = await handler.callStatic.handleOperation(
      provenOp,
      verificationGasForOp,
      bundler,
      { from: walletAddress }
    );
    const {
      opProcessed,
      failureReason,
      callSuccesses,
      callResults,
      verificationGas,
      executionGas,
      numRefunds,
    } = result;

    return {
      opProcessed,
      failureReason,
      callSuccesses,
      callResults,
      verificationGas: verificationGas.toBigInt(),
      executionGas: executionGas.toBigInt(),
      numRefunds: numRefunds.toBigInt(),
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
   * @param largestFirst indicate large to small ordering, defaults to false
   */
  async gatherMinimumNotes(
    joinSplitRequest: JoinSplitRequest,
    largestFirst = false
  ): Promise<IncludedNote[]> {
    await this.ensureMinimumForAssetRequest(joinSplitRequest);
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
   *
   * @param asset Payment asset
   * @param receiver Payment receiver
   * @param value Payment value
   */
  genPaymentRequest(
    asset: Asset,
    receiver: CanonAddress,
    value: bigint,
    executionGasLimit: bigint,
    maxNumRefunds: bigint
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
      executionGasLimit,
      maxNumRefunds,
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
