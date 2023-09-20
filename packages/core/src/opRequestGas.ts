import { Handler } from "@nocturne-xyz/contracts";
import { NocturneViewer, StealthAddress } from "./crypto";
import { NocturneDB } from "./NocturneDB";
import {
  GasAccountedOperationRequest,
  JoinSplitRequest,
  OperationRequest,
} from "./operationRequest/operationRequest";
import {
  Operation,
  OperationResult,
  Asset,
  PreSignOperation,
  BLOCK_GAS_LIMIT,
  AssetType,
  ProvenJoinSplit,
  SubmittableOperationWithNetworkInfo,
  toSubmittableOperation,
  IncludedNote,
} from "./primitives";
import { ERC20_ID } from "./primitives/asset";
import { groupByMap, partition } from "./utils/functional";
import { gatherNotes, prepareOperation } from "./prepareOperation";
import { MapWithObjectKeys, getJoinSplitRequestTotalValue } from "./utils";
import { SparseMerkleProver } from "./SparseMerkleProver";
import { EthToTokenConverter } from "./conversion";
import {
  maxGasForOperation,
  MAX_GAS_FOR_ADDITIONAL_JOINSPLIT,
} from "./primitives/gasCalculation";
import { getIncludedNotesFromOp } from "./primitives/typeHelpers";

// If gas asset refund is less than this amount * gasPrice denominated in the gas asset, refund will
// not be processed and funds will be sent to bundler. This is because cost of processing would
// outweight value of note.
const DEFAULT_GAS_ASSET_REFUND_THRESHOLD_GAS = 600_000n;

const DUMMY_GAS_ASSET: Asset = {
  assetType: AssetType.ERC20,
  assetAddr: "0x0000000000000000000000000000000000000000",
  id: ERC20_ID,
};

interface AssetAndTicker {
  asset: Asset;
  ticker: string;
}

export interface HandleOpRequestGasDeps {
  db: NocturneDB;
  handlerContract: Handler;
  gasAssets: Map<string, Asset>;
  tokenConverter: EthToTokenConverter;
  merkle: SparseMerkleProver;
}

interface GasEstimatedOperationRequest
  extends Omit<OperationRequest, "executionGasLimit" | "gasPrice"> {
  executionGasLimit: bigint;
  gasPrice: bigint;
}

interface OpRequestTraceParams {
  totalGasLimit: bigint;
  executionGasLimit: bigint;
  gasPrice: bigint;
  usedNotes: MapWithObjectKeys<Asset, IncludedNote[]>;
}

// VK corresponding to SK of 1 with minimum valid nonce
const DUMMY_VIEWER = new NocturneViewer(
  655374300543486358510310527362452574140738137308572239595396943710924175576n,
  3n
);

const DUMMY_REFUND_ADDR: StealthAddress =
  DUMMY_VIEWER.generateRandomStealthAddress();

export async function handleGasForOperationRequest(
  deps: HandleOpRequestGasDeps,
  opRequest: OperationRequest
): Promise<GasAccountedOperationRequest> {
  // estimate gas params for opRequest
  console.log("estimating gas for op request");
  const { totalGasLimit, executionGasLimit, gasPrice, usedNotes } =
    await getOperationRequestTrace(deps, opRequest);

  const gasEstimatedOpRequest: GasEstimatedOperationRequest = {
    ...opRequest,
    executionGasLimit,
    gasPrice,
  };

  if (opRequest?.gasPrice == 0n) {
    // If gasPrice = 0, override dummy gas asset and don't further modify opRequest
    console.log("returning dummy gas asset");
    return {
      ...gasEstimatedOpRequest,
      gasPrice: 0n,
      gasAsset: DUMMY_GAS_ASSET,
      gasAssetRefundThreshold: 0n,
    };
  } else {
    console.log(`total gas limit pre gas update: ${totalGasLimit}`);

    // attempt to update the joinSplitRequests with gas compensation
    // gasAsset will be `undefined` if the user's too broke to pay for gas
    const [joinSplitRequests, gasAssetAndTicker] =
      await tryUpdateJoinSplitRequestsForGasEstimate(
        deps.gasAssets,
        deps.db,
        gasEstimatedOpRequest.joinSplitRequests,
        totalGasLimit,
        gasPrice,
        deps.tokenConverter,
        usedNotes
      );

    if (!gasAssetAndTicker) {
      throw new Error("not enough owned gas tokens pay for op");
    }

    const gasAssetRefundThreshold = await deps.tokenConverter.weiToTargetErc20(
      DEFAULT_GAS_ASSET_REFUND_THRESHOLD_GAS * gasPrice,
      gasAssetAndTicker.ticker
    );

    return {
      ...gasEstimatedOpRequest,
      gasAssetRefundThreshold,
      joinSplitRequests,
      gasAsset: gasAssetAndTicker.asset,
    };
  }
}

// update the joinSplitRequests to include any additional gas compensation, if needed
// returns the updated JoinSplitRequests and the gas asset used to pay for gas if the user can afford gas
// if the user can't afford gas, returns an empty array and undefined.
async function tryUpdateJoinSplitRequestsForGasEstimate(
  gasAssets: Map<string, Asset>,
  db: NocturneDB,
  joinSplitRequests: JoinSplitRequest[],
  gasUnitsEstimate: bigint,
  gasPrice: bigint,
  tokenConverter: EthToTokenConverter,
  usedNotes: MapWithObjectKeys<Asset, IncludedNote[]>
): Promise<[JoinSplitRequest[], AssetAndTicker | undefined]> {
  // group joinSplitRequests by asset address
  const joinSplitRequestsByAsset = groupByMap(
    joinSplitRequests,
    (request) => request.asset.assetAddr
  );

  const gasEstimateWei = gasPrice * gasUnitsEstimate;
  const gasEstimatesInGasAssets = await tokenConverter.gasEstimatesInGasAssets(
    gasEstimateWei,
    Array.from(gasAssets.keys())
  );

  const [matchingGasAssets, nonMatchingGasAssets] = partition(
    Array.from(gasAssets.entries()),
    ([_, gasAsset]) => joinSplitRequestsByAsset.has(gasAsset.assetAddr)
  );

  // attempt to find matching gas asset with enough balance
  for (const [ticker, gasAsset] of matchingGasAssets) {
    const totalOwnedGasAsset = await db.getBalanceForAsset(gasAsset);
    const matchingJoinSplitRequests = joinSplitRequestsByAsset.get(
      gasAsset.assetAddr
    )!;

    const totalAmountInMatchingRequests = matchingJoinSplitRequests.reduce(
      (acc, request) => {
        return acc + getJoinSplitRequestTotalValue(request);
      },
      0n
    );

    // if they have enough for request + gas, modify one of the requests to include the gas, and
    // we're done
    const estimateInGasAsset = gasEstimatesInGasAssets.get(ticker)!;
    if (
      totalOwnedGasAsset >=
      estimateInGasAsset + totalAmountInMatchingRequests
    ) {
      const usedNotesForGasAsset = usedNotes.get(gasAsset)!;
      const usedMerkleIndicesForGasAsset = new Set(
        usedNotesForGasAsset.map((note) => note.merkleIndex)
      );
      const totalValueInExistingJoinSplits = usedNotesForGasAsset.reduce(
        (acc, note) => acc + note.value,
        0n
      );
      const remainingValueNeededInNewJoinSplits =
        totalAmountInMatchingRequests +
        estimateInGasAsset -
        totalValueInExistingJoinSplits;

      let extraJoinSplitsGas: bigint;
      let numExtraJoinSplits: number;
      if (remainingValueNeededInNewJoinSplits > 0n) {
        // Add enough to cover gas needed for existing joinsplits + gas for an extra joinsplits
        const extraNotes = await gatherNotes(
          db,
          remainingValueNeededInNewJoinSplits,
          gasAsset,
          usedMerkleIndicesForGasAsset
        );
        numExtraJoinSplits = Math.ceil(extraNotes.length / 2);
        extraJoinSplitsGas =
          BigInt(numExtraJoinSplits) *
          MAX_GAS_FOR_ADDITIONAL_JOINSPLIT *
          gasPrice;

        if (totalOwnedGasAsset < estimateInGasAsset + extraJoinSplitsGas) {
          throw new Error(
            `not enough owned gas tokens to pay for gas + extra joinsplit. required: ${estimateInGasAsset} + ${extraJoinSplitsGas}. Owned: ${totalOwnedGasAsset}`
          );
        }
      } else {
        // otherwise we don't need any extra joinsplits because existing notes cover gas cost
        extraJoinSplitsGas = 0n;
        numExtraJoinSplits = 0;
      }

      console.log(
        `adding ${extraJoinSplitsGas} tokens for ${numExtraJoinSplits} extra joinsplits for gas compensation`
      );
      matchingJoinSplitRequests[0].unwrapValue +=
        estimateInGasAsset + extraJoinSplitsGas;
      joinSplitRequestsByAsset.set(
        gasAsset.assetAddr,
        matchingJoinSplitRequests
      );

      console.log(
        `amount to add for gas asset by modifying existing joinsplit for gas asset with ticker ${ticker}: ${estimateInGasAsset}}`,
        { gasAssetTicker: ticker, gasAsset, estimateInGasAsset }
      );

      return [
        Array.from(joinSplitRequestsByAsset.values()).flat(),
        { asset: gasAsset, ticker },
      ];
    }
  }

  // if we couldn't find an existing joinsplit request with a supported gas asset,
  // attempt to make a new joinsplit request to include the gas comp
  // iterate through each gas asset
  for (const [ticker, gasAsset] of nonMatchingGasAssets) {
    const estimateInGasAsset = gasEstimatesInGasAssets.get(ticker)!;
    const totalOwnedGasAsset = await db.getBalanceForAsset(gasAsset);

    if (totalOwnedGasAsset >= estimateInGasAsset) {
      // Add enough to cover gas needed for existing joinsplits + gas for an extra joinsplits
      const extraNotes = await gatherNotes(db, estimateInGasAsset, gasAsset);
      const numExtraJoinSplits = Math.ceil(extraNotes.length / 2);
      const additionaJoinSplitGas =
        BigInt(numExtraJoinSplits) *
        MAX_GAS_FOR_ADDITIONAL_JOINSPLIT *
        gasPrice;
      const estimateInGasAssetIncludingNewJoinSplits =
        estimateInGasAsset + additionaJoinSplitGas;

      if (totalOwnedGasAsset < estimateInGasAssetIncludingNewJoinSplits) {
        throw new Error(
          `not enough owned gas tokens to pay for gas + extra joinsplit. Required: ${estimateInGasAssetIncludingNewJoinSplits}. Owned: ${totalOwnedGasAsset}`
        );
      }

      const modifiedJoinSplitRequests = joinSplitRequests.concat({
        asset: gasAsset,
        unwrapValue: estimateInGasAssetIncludingNewJoinSplits,
      });

      console.log(
        `amount to add for gas asset by adding a new joinsplit for gas asset with ticker ${ticker}: ${estimateInGasAssetIncludingNewJoinSplits}`,
        {
          gasAssetTicker: ticker,
          gasAsset,
          estimateInGasAssetIncludingNewJoinSplits,
        }
      );

      return [modifiedJoinSplitRequests, { asset: gasAsset, ticker }];
    }
  }

  // if we get here, the user can't afford the gas
  return [[], undefined];
}

// estimate gas params for opRequest
async function getOperationRequestTrace(
  { handlerContract, ...deps }: HandleOpRequestGasDeps,
  opRequest: OperationRequest
): Promise<OpRequestTraceParams> {
  let { executionGasLimit, gasPrice } = opRequest;

  // Simulate operation to get number of joinSplits
  const dummyOpRequest: GasAccountedOperationRequest = {
    ...opRequest,
    gasAssetRefundThreshold: 0n,
    executionGasLimit: BLOCK_GAS_LIMIT,
    refundAddr: DUMMY_REFUND_ADDR,
    // Use 0 gas price and dummy asset for simulation
    gasPrice: 0n,
    gasAsset: DUMMY_GAS_ASSET,
  };

  // prepare the request into an operation using a dummy viewer
  const preparedOp = await prepareOperation(
    { viewer: DUMMY_VIEWER, ...deps },
    dummyOpRequest
  );
  const usedNotes = getIncludedNotesFromOp(preparedOp);

  // simulate the operation
  if (!executionGasLimit) {
    console.log("simulating operation");
    const result = await simulateOperation(
      handlerContract,
      preparedOp as PreSignOperation
    );
    if (!result.opProcessed) {
      throw Error("cannot estimate gas with Error: " + result.failureReason);
    }

    // set executionGasLimit with 20% buffer above the simulation result
    executionGasLimit = (result.executionGas * 12n) / 10n;
  }

  preparedOp.executionGasLimit = executionGasLimit;
  const totalGasLimit = maxGasForOperation(preparedOp);

  // if gasPrice is not specified, get it from RPC node
  // NOTE: gasPrice returned in wei
  gasPrice =
    gasPrice ??
    ((await handlerContract.provider.getGasPrice()).toBigInt() * 14n) / 10n;

  return {
    totalGasLimit,
    executionGasLimit,
    gasPrice,
    usedNotes,
  };
}

async function simulateOperation(
  handlerContract: Handler,
  op: Operation
): Promise<OperationResult> {
  // We need to do staticCall, which fails if wallet is connected to a signer
  // https://github.com/ethers-io/ethers.js/discussions/3327#discussioncomment-3539505
  // Switching to a regular provider underlying the signer
  if (handlerContract.signer) {
    handlerContract = handlerContract.connect(handlerContract.provider);
  }

  // Fill-in the some fake proof
  const opWithFakeProofs = fakeProvenOperation(op);

  // Set gasPrice to 0 so that gas payment does not interfere with amount of
  // assets unwrapped pre gas estimation
  // ?: does this actually do anything if it's after `fakeProvenOperation` dummy provenOp?
  op.gasPrice = 0n;

  // Set dummy parameters which should not affect operation simulation
  const verificationGasForOp = 0n;
  const bundler = handlerContract.address;

  const tellerAddress = await handlerContract._teller();

  const result = await handlerContract.callStatic.handleOperation(
    // TODO: fix after contract changes
    //@ts-ignore
    opWithFakeProofs,
    verificationGasForOp,
    bundler,
    {
      from: tellerAddress,
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

function fakeProvenOperation(
  op: Operation
): SubmittableOperationWithNetworkInfo {
  const provenJoinSplits = op.joinSplits.map((js) => {
    return {
      ...js,
      proof: [0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n],
    };
  }) as ProvenJoinSplit[];

  return toSubmittableOperation({
    networkInfo: op.networkInfo,
    joinSplits: provenJoinSplits,
    refundAddr: op.refundAddr,
    actions: op.actions,
    refunds: op.refunds,
    encodedGasAsset: op.encodedGasAsset,
    gasAssetRefundThreshold: op.gasAssetRefundThreshold,
    executionGasLimit: op.executionGasLimit,
    gasPrice: op.gasPrice,
    deadline: op.deadline,
    atomicActions: op.atomicActions,
  });
}
