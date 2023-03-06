import { Wallet } from "@nocturne-xyz/contracts";
import { NocturneViewer, StealthAddress } from "./crypto";
import { NotesDB } from "./db";
import {
  GasAccountedOperationRequest,
  GasEstimatedOperationRequest,
  JoinSplitRequest,
  OperationRequest,
} from "./operationRequest";
import { OpPreparer } from "./opPreparer";
import {
  Operation,
  ProvenOperation,
  OperationResult,
  Asset,
  PreSignOperation,
  BLOCK_GAS_LIMIT,
  AssetType,
} from "./primitives";
import { ERC20_ID } from "./primitives/asset";
import { SolidityProof } from "./proof";

const DUMMY_REFUND_ADDR: StealthAddress = {
  h1X: 0n,
  h1Y: 0n,
  h2X: 0n,
  h2Y: 0n,
};

const DUMMY_GAS_ASSET: Asset = {
  assetType: AssetType.ERC20,
  assetAddr: "0x0000000000000000000000000000000000000000",
  id: ERC20_ID,
};

const DEFAULT_GAS_PRICE = 0n;
const DEFAULT_EXECUTION_GAS_LIMIT = 500_000n;

const PER_JOINSPLIT_GAS = 170_000n;
const PER_REFUND_GAS = 80_000n;

export class OpRequestPreparer {
  private readonly wallet: Wallet;
  private readonly preparer: OpPreparer;
  private readonly viewer: NocturneViewer;
  private readonly notesDB: NotesDB;
  private readonly gasAssets: Map<string, Asset>;

  constructor(
    wallet: Wallet,
    preparer: OpPreparer,
    viewer: NocturneViewer,
    notesDB: NotesDB,
    gasAssets: Map<string, Asset>
  ) {
    this.wallet = wallet;
    this.preparer = preparer;
    this.viewer = viewer;
    this.notesDB = notesDB;
    this.gasAssets = gasAssets;
  }

  async prepareOperationRequest(
    opRequest: OperationRequest
  ): Promise<GasAccountedOperationRequest> {
    const gasEstimatedOperation = await this.getGasEstimatedOperationRequest(
      opRequest
    );

    if (opRequest?.gasPrice == 0n) {
      // If gasPrice = 0, use dummy gas asset and don't further modify opRequest
      return {
        ...gasEstimatedOperation,
        gasPrice: 0n,
        gasAsset: DUMMY_GAS_ASSET,
      };
    } else {
      // Otherwise, get gas asset and modify joinsplit request
      return this.getGasCompAccountedOperationRequest(gasEstimatedOperation);
    }
  }

  // Fill operation request refundAddr and any gas-related values
  private async getGasEstimatedOperationRequest(
    opRequest: OperationRequest
  ): Promise<GasEstimatedOperationRequest> {
    // Estimate execution gas ignoring gas comp
    const preSimulateOpRequest = await this.getPreSimulateOperation(opRequest);

    let executionGasLimit: bigint, maxNumRefunds: bigint;
    if (opRequest.executionGasLimit && opRequest.maxNumRefunds) {
      ({ executionGasLimit, maxNumRefunds } = opRequest);
    } else {
      ({ executionGasLimit, maxNumRefunds } =
        await this.getGasEstimatedOperation(preSimulateOpRequest));
    }

    return {
      ...opRequest,
      refundAddr:
        opRequest.refundAddr ?? this.viewer.generateRandomStealthAddress(),
      executionGasLimit,
      maxNumRefunds,
    };
  }

  // Return dummy operation solely for purpose of simulation
  private async getPreSimulateOperation(
    opRequest: OperationRequest
  ): Promise<PreSignOperation> {
    const { maxNumRefunds, joinSplitRequests, refundAssets } = opRequest;

    // Fill operation request with mix of estimated and dummy values
    const dummyOpRequest: GasAccountedOperationRequest = {
      ...opRequest,
      maxNumRefunds:
        maxNumRefunds ??
        BigInt(joinSplitRequests.length + refundAssets.length) + 5n,
      executionGasLimit: DEFAULT_EXECUTION_GAS_LIMIT,
      refundAddr: DUMMY_REFUND_ADDR,
      // Use 0 gas price and dummy asset for simulation
      gasPrice: 0n,
      gasAsset: DUMMY_GAS_ASSET,
    };

    return this.preparer.prepareOperation(dummyOpRequest);
  }

  private async getGasEstimatedOperation(
    op: Partial<PreSignOperation>
  ): Promise<PreSignOperation> {
    op.executionGasLimit = op.executionGasLimit ?? BLOCK_GAS_LIMIT;
    op.gasPrice = op.gasPrice ?? 0n;

    console.log("Simulating op");
    const result = await this.simulateOperation(op as PreSignOperation);
    if (!result.opProcessed) {
      throw Error("Cannot estimate gas with Error: " + result.failureReason);
    }
    // Give 20% over-estimate
    op.executionGasLimit = (result.executionGas * 12n) / 10n;

    // Get number of expected refunds
    op.maxNumRefunds = result.numRefunds;

    return op as PreSignOperation;
  }

  private async getGasCompAccountedOperationRequest(
    opRequest: GasEstimatedOperationRequest
  ): Promise<GasAccountedOperationRequest> {
    if (!opRequest.gasPrice || opRequest.gasPrice == 0n) {
      throw new Error(
        "Should never try to create gas accounted op request with 0 or undefined gas price"
      );
    }

    // Get gas asset given proper gas estimate
    const totalGasEstimate = estimateOperationRequestTotalGas(opRequest);
    const maybeGasAsset = await this.getOptimalGasAsset(
      opRequest.joinSplitRequests,
      totalGasEstimate
    );
    if (!maybeGasAsset) {
      throw new Error("Not enough gas tokens owned to pay for op");
    }

    // Modify joinsplit requests with gas token
    const modifiedJoinSplitRequests =
      this.attachGasCompensationToJoinSplitRequests(
        opRequest.joinSplitRequests,
        maybeGasAsset,
        totalGasEstimate
      );
    opRequest.joinSplitRequests = modifiedJoinSplitRequests;
    return {
      ...opRequest,
      gasPrice: opRequest.gasPrice,
      gasAsset: maybeGasAsset,
    };
  }

  private async getOptimalGasAsset(
    existingJoinSplitRequests: JoinSplitRequest[],
    gasEstimate: bigint
  ): Promise<Asset | undefined> {
    // Convert JoinSplitRequest[] into Map<address, JoinSplitRequest>
    const joinSplitsMapByAsset = new Map(
      existingJoinSplitRequests.map((req) => {
        return [req.asset.assetAddr, req];
      })
    );

    // Look for existing joinsplit request with supported gas token first
    for (const gasAsset of this.gasAssets.values()) {
      const maybeMatchingJoinSplitReq = joinSplitsMapByAsset.get(
        gasAsset.assetAddr
      );

      // If already unwrapping gas asset in joinsplit reqs, check if enough
      if (maybeMatchingJoinSplitReq) {
        const totalOwnedGasAsset = await this.notesDB.getBalanceForAsset(
          gasAsset
        );

        // If enough, modify joinsplit requests and returned modified
        if (totalOwnedGasAsset >= gasEstimate) {
          return maybeMatchingJoinSplitReq.asset;
        }
      }
    }

    // If gas asset not found in existing joinsplit reqs, try make separate one
    for (const gasAsset of this.gasAssets.values()) {
      const totalOwnedGasAsset = await this.notesDB.getBalanceForAsset(
        gasAsset
      );
      if (totalOwnedGasAsset >= gasEstimate) {
        return gasAsset;
      }
    }

    return undefined;
  }

  private attachGasCompensationToJoinSplitRequests(
    joinSplitRequests: JoinSplitRequest[],
    gasAsset: Asset,
    totalGasEstimate: bigint
  ): JoinSplitRequest[] {
    // Convert JoinSplitRequest[] into Map<address, JoinSplitRequest>
    const joinSplitsMapByAsset = new Map(
      joinSplitRequests.map((req) => {
        return [req.asset.assetAddr, req];
      })
    );

    // Check if existing joinsplit with gas asset
    const maybeMatchingJoinSplitRequest = joinSplitsMapByAsset.get(
      gasAsset.assetAddr
    );

    // Either append gas cost to existing or create new joinsplit request
    if (maybeMatchingJoinSplitRequest) {
      maybeMatchingJoinSplitRequest.unwrapValue =
        maybeMatchingJoinSplitRequest.unwrapValue + totalGasEstimate;
      joinSplitsMapByAsset.set(
        maybeMatchingJoinSplitRequest.asset.assetAddr,
        maybeMatchingJoinSplitRequest
      );
    } else {
      const newJoinSplitRequest = {
        asset: gasAsset,
        unwrapValue: totalGasEstimate,
      };
      joinSplitsMapByAsset.set(gasAsset.assetAddr, newJoinSplitRequest);
    }

    return Array.from(joinSplitsMapByAsset.values());
  }

  async simulateOperation(op: Operation): Promise<OperationResult> {
    // We need to do staticCall, which fails if wallet is connected to a signer
    // https://github.com/ethers-io/ethers.js/discussions/3327#discussioncomment-3539505
    // Switching to a regular provider underlying the signer
    let wallet = this.wallet;
    if (this.wallet.signer) {
      wallet = this.wallet.connect(wallet.provider);
    }

    // Fill-in the some fake proof
    const provenOp = this.fakeProvenOperation(op);

    // Set gasPrice to 0 so that gas payment does not interfere with amount of
    // assets unwrapped pre gas estimation
    // ?: does this actually do anything if it's after `fakeProvenOperation` dummy provenOp?
    op.gasPrice = 0n;

    // Set dummy parameters which should not affect operation simulation
    const verificationGasForOp = 0n;
    const bundler = wallet.address;

    const result = await wallet.callStatic.processOperation(
      provenOp,
      verificationGasForOp,
      bundler,
      {
        from: wallet.address,
      }
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

  private fakeProvenOperation(op: Operation): ProvenOperation {
    const provenJoinSplits = op.joinSplits.map((joinSplit) => {
      return {
        commitmentTreeRoot: joinSplit.commitmentTreeRoot,
        nullifierA: joinSplit.nullifierA,
        nullifierB: joinSplit.nullifierB,
        newNoteACommitment: joinSplit.newNoteACommitment,
        newNoteBCommitment: joinSplit.newNoteBCommitment,
        encodedAsset: joinSplit.encodedAsset,
        publicSpend: joinSplit.publicSpend,
        newNoteAEncrypted: joinSplit.newNoteAEncrypted,
        newNoteBEncrypted: joinSplit.newNoteBEncrypted,
        proof: [0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n] as SolidityProof,
      };
    });
    return {
      refundAddr: op.refundAddr,
      encodedRefundAssets: op.encodedRefundAssets,
      actions: op.actions,
      encodedGasAsset: op.encodedGasAsset,
      executionGasLimit: op.executionGasLimit,
      maxNumRefunds: op.maxNumRefunds,
      gasPrice: op.gasPrice,
      joinSplits: provenJoinSplits,
    };
  }
}

function estimateOperationRequestTotalGas(opRequest: OperationRequest): bigint {
  const gasPrice = opRequest.gasPrice ?? DEFAULT_GAS_PRICE;
  const executionGasLimit =
    opRequest.executionGasLimit ?? DEFAULT_EXECUTION_GAS_LIMIT;

  return (
    gasPrice *
    (executionGasLimit +
      BigInt(opRequest.joinSplitRequests.length) * PER_JOINSPLIT_GAS +
      BigInt(opRequest.refundAssets.length) * PER_REFUND_GAS)
  );
}
