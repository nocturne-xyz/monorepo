// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {CommonBase} from "forge-std/Base.sol";
import {StdCheats} from "forge-std/StdCheats.sol";
import {StdUtils} from "forge-std/StdUtils.sol";
import {console} from "forge-std/console.sol";

import {TokenSwapper, SwapRequest} from "../../utils/TokenSwapper.sol";
import {TreeTest, TreeTestLib} from "../../utils/TreeTest.sol";
import "../../utils/NocturneUtils.sol";
import "../../utils/ForgeUtils.sol";
import {Teller} from "../../../Teller.sol";
import {Handler} from "../../../Handler.sol";
import {ParseUtils} from "../../utils/ParseUtils.sol";
import {EventParsing} from "../../utils/EventParsing.sol";
import {WETH9} from "../../tokens/WETH9.sol";
import {SimpleERC20Token} from "../../tokens/SimpleERC20Token.sol";
import {AddressSet, LibAddressSet} from "../helpers/AddressSet.sol";
import {ActorSumSet, LibActorSumSet} from "../helpers/ActorSumSet.sol";
import {LibDepositRequestArray} from "../helpers/DepositRequestArray.sol";
import {Utils} from "../../../libs/Utils.sol";
import {AssetUtils} from "../../../libs/AssetUtils.sol";
import {InvariantUtils} from "../helpers/InvariantUtils.sol";
import "../../../libs/Types.sol";

struct GenerateOperationArgs {
    uint256 seed;
    Teller teller;
    address handler;
    uint256 root;
    uint8 exceedJoinSplitsMarginInTokens;
    TokenSwapper swapper;
    address[] joinSplitTokens;
    SimpleERC20Token swapErc20;
}

struct GeneratedOperationMetadata {
    TransferRequest[] transfers;
    uint256[] transferTokenNumbers; // maps transfers[] to what token index in args.joinSplitTokens
    SwapRequest[] swaps;
    uint256[] swapTokenNumbers; // maps swaps[] to what token index in args.joinSplitTokens
    bool[] isTransfer;
    bool[] isSwap;
}

contract OperationGenerator is InvariantUtils {
    uint256 constant ERC20_ID = 0;
    uint256 constant DEFAULT_EXECUTION_GAS_LIMIT = 2_000_000;
    uint256 constant DEFAULT_PER_JOINSPLIT_VERIFY_GAS = 220_000;
    uint256 constant DEFAULT_MAX_NUM_REFUNDS = 9;

    address public transferRecipientAddress;

    uint256 nullifierCount = 0;
    uint256 nonErc20IdCounter = 0;

    constructor(address _transferRecipientAddress) {
        transferRecipientAddress = _transferRecipientAddress;
    }

    function _generateRandomOperation(
        GenerateOperationArgs memory args
    )
        internal
        returns (Operation memory _op, GeneratedOperationMetadata memory _meta)
    {
        uint256 numJoinSplitTokens = args.joinSplitTokens.length;
        uint256[] memory totalJoinSplitUnwrapAmounts = new uint256[](
            numJoinSplitTokens
        );

        for (uint256 i = 0; i < numJoinSplitTokens; i++) {
            totalJoinSplitUnwrapAmounts[i] = bound(
                args.seed,
                0,
                IERC20(args.joinSplitTokens[i]).balanceOf(address(args.teller))
            );
        }

        // Get random args.joinSplitPublicSpends
        uint256[][] memory joinSplitsPublicSpends = new uint256[][](
            numJoinSplitTokens
        );

        console.log("randomizing joinsplit amounts");
        for (uint256 i = 0; i < numJoinSplitTokens; i++) {
            joinSplitsPublicSpends[i] = _randomizeJoinSplitAmounts(
                _rerandomize(args.seed),
                totalJoinSplitUnwrapAmounts[i]
            );
        }

        uint256 totalNumJoinSplits = _totalNumJoinSplitsForJoinSplitsPublicSpends(
                joinSplitsPublicSpends
            );

        // Get random numActions using the bound function, at least 2 to make space for token
        // approvals in case of a swap
        uint256 numActions = bound(_rerandomize(args.seed), 2, 5);

        console.log("getting gas to reserve");
        uint256 gasToReserve = _opMaxGasAssetCost(
            DEFAULT_PER_JOINSPLIT_VERIFY_GAS,
            DEFAULT_EXECUTION_GAS_LIMIT,
            totalNumJoinSplits
        );

        bool compensateBundler = false;
        if (totalJoinSplitUnwrapAmounts[0] > gasToReserve) {
            totalJoinSplitUnwrapAmounts[0] =
                totalJoinSplitUnwrapAmounts[0] -
                gasToReserve;
            compensateBundler = true;
        }

        console.log("formatting actions");
        Action[] memory actions = new Action[](numActions);
        (actions, _meta) = _formatActions(
            args,
            totalJoinSplitUnwrapAmounts,
            numActions
        );

        TrackedAsset[] memory trackedRefundAssets = new TrackedAsset[](1);
        {
            address swapErc20 = address(args.swapErc20);
            trackedRefundAssets[0] = TrackedAsset({
                encodedAsset: AssetUtils.encodeAsset(
                    AssetType.ERC20,
                    swapErc20,
                    ERC20_ID
                ),
                minRefundValue: 0
            });
        }

        console.log("getting gas asset refund threshold");
        uint256 gasAssetRefundThreshold = bound(
            _rerandomize(args.seed),
            0,
            totalJoinSplitUnwrapAmounts[0]
        );

        FormatOperationArgs memory opArgs = FormatOperationArgs({
            joinSplitTokens: args.joinSplitTokens,
            joinSplitRefundValues: new uint256[](numJoinSplitTokens),
            gasToken: args.joinSplitTokens[0], // weth is used as gas token
            root: args.root,
            joinSplitsPublicSpends: joinSplitsPublicSpends,
            trackedRefundAssets: trackedRefundAssets,
            gasAssetRefundThreshold: gasAssetRefundThreshold,
            executionGasLimit: DEFAULT_EXECUTION_GAS_LIMIT,
            gasPrice: compensateBundler ? 1 : 0,
            actions: actions,
            atomicActions: true,
            operationFailureType: OperationFailureType.NONE
        });

        console.log("Formatting op");
        _op = NocturneUtils.formatOperation(opArgs);

        _op = _ensureUniqueNullifiers(_op);
    }

    function _ensureUniqueNullifiers(
        Operation memory op
    ) internal returns (Operation memory) {
        // Make sure nfs do not conflict. Doing here because doing in NocturneUtils would force us
        // to convert NocturneUtils to be stateful contract
        for (uint256 i = 0; i < op.pubJoinSplits.length; i++) {
            op.pubJoinSplits[i].joinSplit.nullifierA = nullifierCount;
            op.pubJoinSplits[i].joinSplit.nullifierB = nullifierCount + 1;

            nullifierCount += 2;
        }

        for (uint256 i = 0; i < op.confJoinSplits.length; i++) {
            op.confJoinSplits[i].nullifierA = nullifierCount;
            op.confJoinSplits[i].nullifierB = nullifierCount + 1;

            nullifierCount += 2;
        }

        return op;
    }

    function _formatActions(
        GenerateOperationArgs memory args,
        uint256[] memory runningJoinSplitAmounts,
        uint256 numActions
    )
        internal
        returns (
            Action[] memory _actions,
            GeneratedOperationMetadata memory _meta
        )
    {
        _actions = new Action[](numActions);
        _meta.transfers = new TransferRequest[](numActions);
        _meta.transferTokenNumbers = new uint256[](numActions);
        _meta.swaps = new SwapRequest[](numActions);
        _meta.swapTokenNumbers = new uint256[](numActions);
        _meta.isTransfer = new bool[](numActions);
        _meta.isSwap = new bool[](numActions);

        // For each action of numActions, switch on transfer vs swap
        for (uint256 i = 0; i < numActions; i++) {
            uint256 tokenToUseIndex = bound(
                _rerandomize(args.seed),
                0,
                args.joinSplitTokens.length - 1
            );
            address token = args.joinSplitTokens[tokenToUseIndex];

            bool isTransfer = bound(args.seed, 0, 1) == 0;

            uint256 transferOrSwapBound;
            unchecked {
                transferOrSwapBound =
                    runningJoinSplitAmounts[tokenToUseIndex] +
                    args.exceedJoinSplitsMarginInTokens;
            }
            uint256 transferOrSwapAmount = bound(
                _rerandomize(args.seed),
                0,
                transferOrSwapBound
            );

            // Swap request requires two actions, if at end of array just fill with transfer and
            // use the rest
            if (i == numActions - 1) {
                isTransfer = true;
            }

            if (isTransfer) {
                {
                    console.log("filling tranfers meta");
                    _meta.transfers[i] = TransferRequest({
                        token: token,
                        recipient: transferRecipientAddress,
                        amount: transferOrSwapAmount
                    });
                    _meta.transferTokenNumbers[i] = tokenToUseIndex;
                    _meta.isTransfer[i] = true;

                    console.log("filling transfers action");
                    _actions[i] = NocturneUtils.formatTransferAction(
                        _meta.transfers[i]
                    );
                }
            } else {
                {
                    console.log("filling swaps meta");
                    _meta.swaps[i + 1] = _createRandomSwapRequest(
                        transferOrSwapAmount,
                        args,
                        token
                    );
                    _meta.swapTokenNumbers[i] = tokenToUseIndex;
                    _meta.isSwap[i + 1] = true;

                    {
                        // Kludge to satisfy stack limit
                        address inToken = token;
                        TokenSwapper swapper = args.swapper;

                        Action memory approveAction = Action({
                            contractAddress: address(inToken),
                            encodedFunction: abi.encodeWithSelector(
                                IERC20(inToken).approve.selector,
                                address(swapper),
                                transferOrSwapAmount
                            )
                        });

                        // Kludge to satisfy stack limit
                        SwapRequest memory swapRequest = _meta.swaps[i + 1];

                        _actions[i] = approveAction;
                        _actions[i + 1] = Action({
                            contractAddress: address(swapper),
                            encodedFunction: abi.encodeWithSelector(
                                swapper.swap.selector,
                                swapRequest
                            )
                        });
                    }

                    i += 1; // additional +1 to skip past swap action at i+1
                }
            }

            console.log("subtracting from runningJoinSplitAmounts");
            runningJoinSplitAmounts[tokenToUseIndex] -= Utils.min(
                transferOrSwapAmount,
                runningJoinSplitAmounts[tokenToUseIndex]
            ); // avoid underflow
        }
    }

    function _totalNumJoinSplitsForJoinSplitsPublicSpends(
        uint256[][] memory joinSplitsPublicSpends
    ) internal pure returns (uint256) {
        uint256 totalJoinSplits = 0;
        for (uint256 i = 0; i < joinSplitsPublicSpends.length; i++) {
            totalJoinSplits += joinSplitsPublicSpends[i].length;
        }

        return totalJoinSplits;
    }

    function _createRandomSwapRequest(
        uint256 swapInAmount,
        GenerateOperationArgs memory args,
        address token
    ) internal returns (SwapRequest memory) {
        // Set encodedAssetIn as joinSplitToken
        EncodedAsset memory encodedAssetIn = AssetUtils.encodeAsset(
            AssetType.ERC20,
            token,
            ERC20_ID
        );

        uint256 swapErc20OutAmount = bound(
            _rerandomize(args.seed),
            0,
            type(uint256).max - args.swapErc20.totalSupply()
        );
        SwapRequest memory swapRequest = SwapRequest({
            assetInOwner: address(args.handler),
            encodedAssetIn: encodedAssetIn,
            assetInAmount: swapInAmount,
            erc20Out: address(args.swapErc20),
            erc20OutAmount: swapErc20OutAmount
        });

        ++nonErc20IdCounter;

        return swapRequest;
    }

    function _randomizeJoinSplitAmounts(
        uint256 seed,
        uint256 totalAmount
    ) internal returns (uint256[] memory) {
        uint256 numJoinSplits = bound(seed, 1, 3); // at most 3 joinsplits per asset
        uint256[] memory joinSplitAmounts = new uint256[](numJoinSplits);

        uint256 remainingAmount = totalAmount;
        for (uint256 i = 0; i < numJoinSplits - 1; i++) {
            // Generate a random amount for the current join split and update the remaining amount
            uint256 randomAmount = bound(
                _rerandomize(seed),
                0,
                remainingAmount
            );
            joinSplitAmounts[i] = randomAmount;
            remainingAmount -= randomAmount;
        }

        // Set the last join split amount to the remaining amount
        joinSplitAmounts[numJoinSplits - 1] = remainingAmount;

        return joinSplitAmounts;
    }

    // Copied from Types.sol and built around not needing op beforehand
    function _opMaxGasAssetCost(
        uint256 perJoinSplitVerifyGas,
        uint256 executionGasLimit,
        uint256 numJoinSplits
    ) internal pure returns (uint256) {
        return
            executionGasLimit +
            ((perJoinSplitVerifyGas + GAS_PER_JOINSPLIT_HANDLE) *
                numJoinSplits) +
            ((GAS_PER_REFUND_TREE + GAS_PER_REFUND_HANDLE) *
                DEFAULT_MAX_NUM_REFUNDS);
    }
}
