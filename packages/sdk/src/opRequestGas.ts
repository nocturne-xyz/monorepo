import { Handler } from "@nocturne-xyz/contracts";
import { NocturneViewer, StealthAddress } from "./crypto";
import { NocturneDB } from "./NocturneDB";
import {
  GasAccountedOperationRequest,
  JoinSplitRequest,
  OperationRequest,
} from "./operationRequest";
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
import { groupByMap, max, partition } from "./utils/functional";
import { prepareOperation } from "./prepareOperation";
import { getJoinSplitRequestTotalValue } from "./utils";
import { SparseMerkleProver } from "./SparseMerkleProver";
import { EthToTokenConverter } from "./conversion";
import { Logger } from "winston";

// refunds < 200k gas * gasPrice converted to gasAsset not worth refunding
const DEFAULT_GAS_ASSET_REFUND_THRESHOLD_GAS = 200_000n;

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

interface AssetAndTicker {
  asset: Asset;
  ticker: string;
}

// TODO: ask bundler for the batch size and make a more intelligent estimate than this
const PER_JOINSPLIT_GAS = 380_000n; // cost of verifying single proof (280k) + handling single joinsplit (80k) + buffer (20k)
const PER_REFUND_GAS = 100_000n; // cost of refund handle (40k) + refund tree (50k) + buffer (10k)

export interface HandleOpRequestGasDeps {
  db: NocturneDB;
  handlerContract: Handler;
  gasAssets: Map<string, Asset>;
  tokenConverter: EthToTokenConverter;
  merkle: SparseMerkleProver;
  logger?: Logger;
}

interface GasEstimatedOperationRequest
  extends Omit<
    OperationRequest,
    "executionGasLimit" | "maxNumRefunds" | "gasPrice"
  > {
  executionGasLimit: bigint;
  maxNumRefunds: bigint;
  gasPrice: bigint;
}

interface GasParams {
  gasPrice: bigint;
  numJoinSplits: bigint;
  executionGasLimit: bigint;
  maxNumRefunds: bigint;
}

// VK corresponding to SK of 1 with minimum valid nonce
const DUMMY_VIEWER = new NocturneViewer(
  655374300543486358510310527362452574140738137308572239595396943710924175576n,
  3n
);

export async function handleGasForOperationRequest(
  deps: HandleOpRequestGasDeps,
  opRequest: OperationRequest
): Promise<GasAccountedOperationRequest> {
  const { logger } = deps;
  // estimate gas params for opRequest
  logger && logger.info("estimating gas for op request");
  const { gasPrice, numJoinSplits, executionGasLimit, maxNumRefunds } =
    await estimateGasForOperationRequest(deps, opRequest);

  const gasEstimatedOpRequest: GasEstimatedOperationRequest = {
    ...opRequest,
    executionGasLimit,
    maxNumRefunds,
    gasPrice,
  };

  if (opRequest?.gasPrice == 0n) {
    // If gasPrice = 0, override dummy gas asset and don't further modify opRequest
    return {
      ...gasEstimatedOpRequest,
      gasPrice: 0n,
      gasAsset: DUMMY_GAS_ASSET,
      gasAssetRefundThreshold: 0n,
    };
  } else {
    // Otherwise, we need to add gas compensation to the operation request

    // compute an estimate of the total amount of gas the op will cost given the gas params
    // we add 1 to `maxNumRefund` because we may add another joinSplitRequest to pay for gas
    const totalGasUnitsEstimate =
      executionGasLimit +
      numJoinSplits * PER_JOINSPLIT_GAS +
      maxNumRefunds * PER_REFUND_GAS;

    logger &&
      logger.debug(`execution gas limit: ${executionGasLimit}`, {
        executionGasLimit,
      });
    logger &&
      logger.debug(`joinSplits gas: ${numJoinSplits * PER_JOINSPLIT_GAS}`, {
        numJoinSplits,
        joinSplitsGas: numJoinSplits * PER_JOINSPLIT_GAS,
      });
    logger &&
      logger.debug(`refunds gas: ${maxNumRefunds * PER_REFUND_GAS}`, {
        maxNumRefunds,
        refundsGas: maxNumRefunds * PER_REFUND_GAS,
      });

    // attempt to update the joinSplitRequests with gas compensation
    // gasAsset will be `undefined` if the user's too broke to pay for gas
    const [joinSplitRequests, gasAssetAndTicker] =
      await tryUpdateJoinSplitRequestsForGasEstimate(
        deps.gasAssets,
        deps.db,
        gasEstimatedOpRequest.joinSplitRequests,
        totalGasUnitsEstimate,
        gasPrice,
        deps.tokenConverter,
        logger
      );

    if (!gasAssetAndTicker) {
      throw new Error("not enough owned gas tokens pay for op");
    }

    // if we've added a new joinSplitRequest to pay for gas, we need to increase maxNumRefunds to reflect that change
    if (
      joinSplitRequests.length > gasEstimatedOpRequest.joinSplitRequests.length
    ) {
      gasEstimatedOpRequest.maxNumRefunds += 1n;
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
  logger?: Logger
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
      // Add enough to cover gas needed for existing joinsplits + gas for an extra joinsplit and refund
      matchingJoinSplitRequests[0].unwrapValue += estimateInGasAsset;
      joinSplitRequestsByAsset.set(
        gasAsset.assetAddr,
        matchingJoinSplitRequests
      );

      logger &&
        logger.debug(
          `amount to add for gas asset by modifying existing joinsplit for gas asset with ticker ${ticker}: ${estimateInGasAsset}}`,
          { gasAssetTicker: ticker, gasAsset, estimateInGasAsset }
        );

      return [
        Array.from(joinSplitRequestsByAsset.values()).flat(),
        { asset: gasAsset, ticker },
      ];
    }
  }

  // if we couldn't find an existing joinsplit with a supported gas asset,
  // attempt to make a new joinsplit request to include the gas comp
  // iterate through each gas asset
  for (const [ticker, gasAsset] of nonMatchingGasAssets) {
    // if user has enough gas token, create a new joinsplit request to include the gas, add it
    // to the list, and we're done
    const totalOwnedGasAsset = await db.getBalanceForAsset(gasAsset);
    const extraJoinSplitWei = gasPrice * (PER_JOINSPLIT_GAS + PER_REFUND_GAS);
    const extraJoinSplitCostInGasAsset = await tokenConverter.weiToTargetErc20(
      extraJoinSplitWei,
      ticker
    );
    const estimateInGasAssetIncludingNewJoinSplit =
      gasEstimatesInGasAssets.get(ticker)! + extraJoinSplitCostInGasAsset;
    if (totalOwnedGasAsset >= estimateInGasAssetIncludingNewJoinSplit) {
      const modifiedJoinSplitRequests = joinSplitRequests.concat({
        asset: gasAsset,
        unwrapValue: estimateInGasAssetIncludingNewJoinSplit,
      });

      logger &&
        logger.debug(
          `amount to add for gas asset by adding a new joinsplit for gas asset with ticker ${ticker}: ${estimateInGasAssetIncludingNewJoinSplit}`,
          {
            gasAssetTicker: ticker,
            gasAsset,
            estimateInGasAssetIncludingNewJoinSplit,
          }
        );

      return [modifiedJoinSplitRequests, { asset: gasAsset, ticker }];
    }
  }

  // if we get here, the user can't afford the gas
  return [[], undefined];
}

// estimate gas params for opRequest
async function estimateGasForOperationRequest(
  { handlerContract, logger, ...deps }: HandleOpRequestGasDeps,
  opRequest: OperationRequest
): Promise<GasParams> {
  let { executionGasLimit, maxNumRefunds, gasPrice } = opRequest;

  // Simulate operation to get number of joinSplits
  const { joinSplitRequests, refundAssets } = opRequest;
  const dummyOpRequest: GasAccountedOperationRequest = {
    ...opRequest,
    maxNumRefunds:
      maxNumRefunds ??
      BigInt(joinSplitRequests.length + refundAssets.length) + 5n, // dummy fill joinsplits length
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
  preparedOp.maxNumRefunds = BigInt(
    preparedOp.joinSplits.length + refundAssets.length + 5
  ); // set correct maxNumRefunds now that we know number of joinsplits

  // simulate the operation
  if (!executionGasLimit || !maxNumRefunds) {
    logger && logger.info("simulating operation");
    const result = await simulateOperation(
      handlerContract,
      preparedOp as PreSignOperation
    );
    if (!result.opProcessed) {
      throw Error("cannot estimate gas with Error: " + result.failureReason);
    }

    // set executionGasLimit with 20% buffer above the simulation result
    if (!executionGasLimit) {
      executionGasLimit = (result.executionGas * 12n) / 10n;
    }

    // If refunds specified > simulation result, use specified amount
    // If refunds specified < simulation result, use simulation result
    if (!maxNumRefunds) {
      maxNumRefunds = max(
        result.numRefunds,
        BigInt(
          preparedOp.joinSplits.length + preparedOp.encodedRefundAssets.length
        )
      );
    }
  }

  // if gasPrice is not specified, get it from RPC node
  // NOTE: gasPrice returned in wei
  gasPrice =
    gasPrice ?? (await handlerContract.provider.getGasPrice()).toBigInt();

  return {
    numJoinSplits: BigInt(preparedOp.joinSplits.length),
    executionGasLimit,
    maxNumRefunds,
    gasPrice,
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
  const provenOp = fakeProvenOperation(op);

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
    provenOp,
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

function fakeProvenOperation(op: Operation): ProvenOperation {
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
      encSenderCanonAddrC1: 0n,
      encSenderCanonAddrC2: 0n,
    };
  });
  return {
    refundAddr: op.refundAddr,
    encodedRefundAssets: op.encodedRefundAssets,
    actions: op.actions,
    encodedGasAsset: op.encodedGasAsset,
    gasAssetRefundThreshold: op.gasAssetRefundThreshold,
    executionGasLimit: op.executionGasLimit,
    maxNumRefunds: op.maxNumRefunds,
    gasPrice: op.gasPrice,
    joinSplits: provenJoinSplits,
    chainId: op.chainId,
    deadline: op.deadline,
    atomicActions: op.atomicActions,
  };
}
