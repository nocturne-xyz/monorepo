import { Handler } from "@nocturne-xyz/contracts";
import {
  Asset,
  AssetTrait,
  AssetType,
  BLOCK_GAS_LIMIT,
  ERC20_ID,
  IncludedNote,
  MapWithObjectKeys,
  Operation,
  OperationResult,
  OperationTrait,
  PreSignOperation,
  ProvenJoinSplit,
  SetWithObjectKeys,
  SparseMerkleProver,
  SubmittableOperationWithNetworkInfo,
  gasCompensationForParams,
} from "@nocturne-xyz/core";
import { NocturneViewer, StealthAddress } from "@nocturne-xyz/crypto";
import { NocturneDB } from "./NocturneDB";
import { EthToTokenConverter } from "./conversion";
import {
  GasAccountedOperationRequest,
  JoinSplitRequest,
  OperationRequest,
} from "./operationRequest/operationRequest";
import {
  NotEnoughFundsError,
  gatherNotes,
  prepareOperation,
} from "./prepareOperation";
import { getIncludedNotesFromOp } from "./utils";

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

export class NotEnoughGasTokensError extends Error {
  constructor(
    public readonly gasAssets: Asset[],
    public readonly gasEstimates: bigint[],
    public readonly gasAssetBalances: bigint[]
  ) {
    super("Not enough gas to execute operation");
    this.name = "NotEnoughGasTokensError";
  }
}

// assume that existing joinsplit requests don't account for gas at all
export async function handleGasForOperationRequest(
  deps: HandleOpRequestGasDeps,
  opRequest: OperationRequest,
  gasMultiplier: number
): Promise<GasAccountedOperationRequest> {
  // estimate gas params for opRequest
  if (process?.env?.DEBUG) {
    console.log("estimating gas for op request");
  }

  const { executionGasLimit, gasPrice, usedNotes } =
    await getOperationRequestTrace(deps, opRequest, gasMultiplier);

  const gasEstimatedOpRequest: GasEstimatedOperationRequest = {
    ...opRequest,
    executionGasLimit,
    gasPrice,
  };

  const [totalGasLimit, joinSplitRequests, gasAssetAndTicker] =
    await tryUpdateJoinSplitRequests(
      deps.db,
      deps.gasAssets,
      deps.tokenConverter,
      usedNotes,
      gasEstimatedOpRequest.joinSplitRequests,
      gasEstimatedOpRequest.refunds.map(({ encodedAsset }) =>
        AssetTrait.decode(encodedAsset)
      ),
      executionGasLimit,
      gasPrice
    );

  const gasAssetRefundThreshold = await deps.tokenConverter.weiToTargetErc20(
    DEFAULT_GAS_ASSET_REFUND_THRESHOLD_GAS * gasPrice,
    gasAssetAndTicker.ticker
  );

  return {
    ...gasEstimatedOpRequest,
    joinSplitRequests,
    gasAsset: gasAssetAndTicker.asset,
    gasAssetRefundThreshold,
    totalGasLimit,
  };
}

// TODO axe this module and account for gas on notes, not JS requests
async function tryUpdateJoinSplitRequests(
  db: NocturneDB,
  gasAssets: Map<string, Asset>,
  tokenConverter: EthToTokenConverter,
  usedNotes: MapWithObjectKeys<Asset, IncludedNote[]>,
  initialJoinSplitRequests: JoinSplitRequest[],
  initialRefundAssets: Asset[],
  executionGasLimit: bigint,
  gasPrice: bigint
): Promise<[bigint, JoinSplitRequest[], AssetAndTicker]> {
  const joinSplitRequests = [...initialJoinSplitRequests];

  console.log("joinsplit requests", joinSplitRequests);

  const computeNumJoinSplits = (
    notes: MapWithObjectKeys<Asset, IncludedNote[]>
  ): number =>
    [...notes.values()]
      .map((notes) => Math.ceil(notes.length / 2))
      .reduce((acc, val) => acc + val, 0);
  const computeNumUniqueAssets = (
    notes: MapWithObjectKeys<Asset, IncludedNote[]>,
    refundAssets: Asset[]
  ): number => {
    const assets = new SetWithObjectKeys<Asset>(notes.keys());
    for (const asset of refundAssets) {
      assets.add(asset);
    }
    return assets.size();
  };

  const initialNumAssets = computeNumUniqueAssets(
    usedNotes,
    initialRefundAssets
  );
  const numJoinSplitsForUsedNotes = computeNumJoinSplits(usedNotes);
  const params = {
    executionGasLimit,
    numJoinSplits: numJoinSplitsForUsedNotes,
    numUniqueAssets: initialNumAssets,
  };
  const initialGasEstimate = gasCompensationForParams(params);

  const failedGasAssets: Asset[] = [];
  const failedGasEstimates: bigint[] = [];
  const failedGasAssetBalances: bigint[] = [];

  // TODO return the cheapest result across all gas assets. Requires price feed
  for (const [ticker, gasAsset] of gasAssets.entries()) {
    // figure out how much "excess" gas asset we have from the initial notes that we can use to cover gas.
    // specifically, the difference between the total note value and total JS request value
    const initialNotesForGasAsset = usedNotes.get(gasAsset);
    const initialNotesForGasAssetValue = (initialNotesForGasAsset ?? []).reduce(
      (acc, { value }) => acc + value,
      0n
    );
    const initialJsrForGasAssetValue = joinSplitRequests
      .filter(
        ({ asset }) =>
          asset.assetAddr === gasAsset.assetAddr &&
          asset.assetType === gasAsset.assetType &&
          asset.id === gasAsset.id
      )
      .reduce((acc, { unwrapValue }) => acc + unwrapValue, 0n);
    const excessInInitialNotes =
      initialNotesForGasAssetValue - initialJsrForGasAssetValue;

    const usedMerkleIndicesForGasAsset = new Set(
      (initialNotesForGasAsset ?? []).map((note) => note.merkleIndex)
    );
    console.log("all notes", await db.getNotesForAsset(gasAsset));
    console.log("used merkle indices", usedMerkleIndicesForGasAsset);
    console.log("intial notes", initialNotesForGasAsset);
    console.log("initial notes value", initialNotesForGasAssetValue);
    console.log("initial jsr value", initialJsrForGasAssetValue);
    console.log("excess in initial notes", excessInInitialNotes);
    console.log("initial params", params)
    console.log("intial comp estimate", await tokenConverter.weiToTargetErc20(initialGasEstimate * gasPrice, ticker));

    // start with no additional gas notes and the `initialGasEstimate` from above
    let currentGasNotesValue = 0n;
    let currentGasEstimate = initialGasEstimate;

    // in the loop below, we'll iteratively attempt to add gas notes until we have enough
    // The high level strategy is:
    // 1. see if `excessInInitialNotes` + value of additional gas notes is enough to cover the gas estimate
    // 2. if so, modify the joinsplit requests and return, otherwise proceed to 3.
    // 3. gather additional gas notes that cover the difference between the gas estimate and the initial excess
    // 4. recompute the gas estimate including the cost to spend additional gas notes
    // 5. go to 1
    while (true) {
      // convert `currentGasEstimate` to a fee estimate in the gas asset
      const compEstimate = await tokenConverter.weiToTargetErc20(
        currentGasEstimate * gasPrice,
        ticker
      );

      // check if we have enough
      if (currentGasNotesValue + excessInInitialNotes >= compEstimate) {
        // if a new joinsplit request is needed, modify an existing one, otherwise add a new one
        const existingJsrIdx = joinSplitRequests.findIndex(
          ({ asset }) =>
            asset.assetAddr === gasAsset.assetAddr &&
            asset.assetType === gasAsset.assetType &&
            asset.id === gasAsset.id
        );
        if (existingJsrIdx !== -1) {
          // assign new to avoid destructively modifying the original
          const req = joinSplitRequests[existingJsrIdx];
          joinSplitRequests[existingJsrIdx] = {
            ...req,
            unwrapValue: req.unwrapValue + compEstimate,
          };
        } else {
          joinSplitRequests.push({
            asset: gasAsset,
            unwrapValue: compEstimate,
          });
        }

        return [
          currentGasEstimate,
          joinSplitRequests,
          { asset: gasAsset, ticker },
        ];
      }

      // try to gather new notes to cover the difference between the required
      // comp and the initial excess in `usedNotes`
      let newGasNotes: IncludedNote[];
      try {
        newGasNotes = await gatherNotes(
          db,
          compEstimate - excessInInitialNotes,
          gasAsset,
          usedMerkleIndicesForGasAsset
        );
      } catch (err) {
        if (err instanceof NotEnoughFundsError) {
          console.warn("didn't have enough", {
            compEstimate,
            excessInInitialNotes,
            available: err.ownedAmount
          })
          failedGasAssets.push(gasAsset);
          failedGasEstimates.push(compEstimate);
          failedGasAssetBalances.push(err.ownedAmount);
          break;
        }

        throw err;
      }

      // compute a new gas estimate including the cost to spend the new gas notes
      // HACK: destructively modify `usedNotes` to include the new gas notes and put it back after we're done
      usedNotes.set(gasAsset, [
        ...(initialNotesForGasAsset ?? []),
        ...newGasNotes,
      ]);
      const params = {
        executionGasLimit,
        numJoinSplits: computeNumJoinSplits(usedNotes),
        numUniqueAssets: computeNumUniqueAssets(usedNotes, initialRefundAssets),
      };

      console.log("new params", params);
      currentGasEstimate = gasCompensationForParams(params);
      if (initialNotesForGasAsset !== undefined) {
        usedNotes.set(gasAsset, initialNotesForGasAsset);
      } else {
        usedNotes.delete(gasAsset);
      }

      currentGasNotesValue = newGasNotes.reduce(
        (acc, { value }) => acc + value,
        0n
      );

      console.log("new comp estimate", await tokenConverter.weiToTargetErc20(currentGasEstimate * gasPrice, ticker));
      console.log("new notes value", currentGasNotesValue);
    }
  }

  // if we get here, the user can't afford the gas
  throw new NotEnoughGasTokensError(
    failedGasAssets,
    failedGasEstimates,
    failedGasAssetBalances
  );
}

// estimate gas params for opRequest
async function getOperationRequestTrace(
  { handlerContract, ...deps }: HandleOpRequestGasDeps,
  opRequest: OperationRequest,
  gasMultiplier: number
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
    totalGasLimit: BLOCK_GAS_LIMIT,
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

  const scale = 100;
  const gasMultiplierScaled = BigInt(Math.floor(gasMultiplier * scale));
  // if gasPrice is not specified, get it from RPC node
  // NOTE: gasPrice returned in wei
  gasPrice =
    gasPrice ??
    ((await handlerContract.provider.getGasPrice()).toBigInt() *
      gasMultiplierScaled) /
      BigInt(Math.floor(scale));

  return {
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

  return OperationTrait.toSubmittable({
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
