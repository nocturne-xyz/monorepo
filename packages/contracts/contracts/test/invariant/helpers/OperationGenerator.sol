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
import {SimpleERC721Token} from "../../tokens/SimpleERC721Token.sol";
import {SimpleERC1155Token} from "../../tokens/SimpleERC1155Token.sol";
import {AddressSet, LibAddressSet} from "../helpers/AddressSet.sol";
import {ActorSumSet, LibActorSumSet} from "../helpers/ActorSumSet.sol";
import {LibDepositRequestArray} from "../helpers/DepositRequestArray.sol";
import {Utils} from "../../../libs/Utils.sol";
import {AssetUtils} from "../../../libs/AssetUtils.sol";
import "../../../libs/Types.sol";

struct GenerateOperationArgs {
    uint256 seed;
    Teller teller;
    address handler;
    uint256 root;
    // NOTE: this is dumb workaround for foundry being buggy. If this is set to true for both, the
    // teller invariant tests hang for no apparent reason
    bool statefulNfGeneration;
    uint8 exceedJoinSplitsMarginInTokens;
    TokenSwapper swapper;
    SimpleERC20Token joinSplitToken;
    SimpleERC20Token gasToken;
    SimpleERC20Token swapErc20;
    SimpleERC721Token swapErc721;
    SimpleERC1155Token swapErc1155;
}

struct GeneratedOperationMetadata {
    TransferRequest[] transfers;
    SwapRequest[] swaps;
    bool[] isTransfer;
    bool[] isSwap;
}

contract OperationGenerator is CommonBase, StdCheats, StdUtils {
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
        // Get random totalJoinSplitUnwrapAmount using the bound function
        uint256 totalJoinSplitUnwrapAmount = bound(
            args.seed,
            0,
            args.joinSplitToken.balanceOf(address(args.teller))
        );
        uint256 totalJoinSplitForActions = totalJoinSplitUnwrapAmount;

        // Get random args.joinSplitPublicSpends
        uint256[] memory joinSplitPublicSpends = _randomizeJoinSplitAmounts(
            args.seed,
            totalJoinSplitUnwrapAmount
        );

        // Get random numActions using the bound function, at least 2 to make space for token
        // approvals in case of a swap
        uint256 numActions = bound(args.seed, 2, 5);

        uint256 gasToReserve = _opMaxGasAssetCost(
            DEFAULT_PER_JOINSPLIT_VERIFY_GAS,
            DEFAULT_EXECUTION_GAS_LIMIT,
            joinSplitPublicSpends.length,
            DEFAULT_MAX_NUM_REFUNDS
        );

        bool compensateBundler = false;
        if (totalJoinSplitForActions > gasToReserve) {
            totalJoinSplitForActions = totalJoinSplitForActions - gasToReserve;
            compensateBundler = true;
        }

        Action[] memory actions = new Action[](numActions);
        (actions, _meta) = _formatActions(
            args,
            totalJoinSplitForActions,
            numActions
        );

        EncodedAsset[] memory encodedRefundAssets = new EncodedAsset[](1);
        encodedRefundAssets[0] = AssetUtils.encodeAsset(
            AssetType.ERC20,
            address(args.swapErc20),
            ERC20_ID
        );

        FormatOperationArgs memory opArgs = FormatOperationArgs({
            joinSplitToken: args.joinSplitToken,
            gasToken: args.gasToken,
            root: args.root,
            joinSplitPublicSpends: joinSplitPublicSpends,
            encodedRefundAssets: encodedRefundAssets,
            executionGasLimit: DEFAULT_EXECUTION_GAS_LIMIT,
            maxNumRefunds: DEFAULT_MAX_NUM_REFUNDS, // TODO: take based on number of swaps
            gasPrice: compensateBundler ? 1 : 0,
            actions: actions,
            atomicActions: true,
            operationFailureType: OperationFailureType.NONE
        });

        _op = NocturneUtils.formatOperation(opArgs);

        // Make sure nfs do not conflict. Doing here because doing in NocturneUtils would force us
        // to convert NocturneUtils to be stateful contract
        for (uint256 i = 0; i < _op.joinSplits.length; i++) {
            if (args.statefulNfGeneration) {
                _op.joinSplits[i].nullifierA = nullifierCount;
                _op.joinSplits[i].nullifierB = nullifierCount + 1;

                nullifierCount += 2;

                console.log("NF A", _op.joinSplits[i].nullifierA);
                console.log("NF B", _op.joinSplits[i].nullifierB);
            } else {
                // Overflow here doesn't matter given all we need are random nfs
                unchecked {
                    _op.joinSplits[i].nullifierA = args.seed + (2 * i);
                    _op.joinSplits[i].nullifierB = args.seed + (2 * i) + 1;
                }
            }
        }
    }

    function _formatActions(
        GenerateOperationArgs memory args,
        uint256 totalJoinSplitAmount,
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
        _meta.swaps = new SwapRequest[](numActions);
        _meta.isTransfer = new bool[](numActions);
        _meta.isSwap = new bool[](numActions);

        uint256 runningJoinSplitAmount = totalJoinSplitAmount;

        // For each action of numActions, switch on transfer vs swap
        for (uint256 i = 0; i < numActions; i++) {
            bool isTransfer = bound(args.seed, 0, 1) == 0;

            uint256 transferOrSwapBound;
            unchecked {
                transferOrSwapBound =
                    runningJoinSplitAmount +
                    args.exceedJoinSplitsMarginInTokens;
            }
            uint256 transferOrSwapAmount = bound(
                args.seed,
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
                    _meta.transfers[i] = TransferRequest({
                        token: args.joinSplitToken,
                        recipient: transferRecipientAddress,
                        amount: transferOrSwapAmount
                    });
                    _meta.isTransfer[i] = true;

                    _actions[i] = NocturneUtils.formatTransferAction(
                        _meta.transfers[i]
                    );
                }
            } else {
                {
                    _meta.swaps[i + 1] = _createRandomSwapRequest(
                        transferOrSwapAmount,
                        args
                    );
                    _meta.isSwap[i + 1] = true;

                    {
                        // Kludge to satisfy stack limit
                        SimpleERC20Token inToken = args.joinSplitToken;
                        TokenSwapper swapper = args.swapper;

                        Action memory approveAction = Action({
                            contractAddress: address(inToken),
                            encodedFunction: abi.encodeWithSelector(
                                inToken.approve.selector,
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

                runningJoinSplitAmount -= Utils.min(
                    transferOrSwapAmount,
                    runningJoinSplitAmount
                ); // avoid underflow
            }
        }
    }

    function _createRandomSwapRequest(
        uint256 swapInAmount,
        GenerateOperationArgs memory args
    ) internal returns (SwapRequest memory) {
        // Set encodedAssetIn as joinSplitToken
        EncodedAsset memory encodedAssetIn = AssetUtils.encodeAsset(
            AssetType.ERC20,
            address(args.joinSplitToken),
            ERC20_ID
        );

        uint256 swapErc20OutAmount = bound(
            args.seed,
            0,
            type(uint256).max - args.swapErc20.totalSupply()
        );
        uint256 swapErc1155OutAmount = bound(args.seed, 0, 10_000_000);
        SwapRequest memory swapRequest = SwapRequest({
            assetInOwner: address(args.handler),
            encodedAssetIn: encodedAssetIn,
            assetInAmount: swapInAmount,
            erc20Out: address(args.swapErc20),
            erc20OutAmount: swapErc20OutAmount,
            erc721Out: address(args.swapErc721),
            erc721OutId: nonErc20IdCounter,
            erc1155Out: address(args.swapErc1155),
            erc1155OutId: nonErc20IdCounter,
            erc1155OutAmount: swapErc1155OutAmount
        });

        ++nonErc20IdCounter;

        return swapRequest;
    }

    function _randomizeJoinSplitAmounts(
        uint256 seed,
        uint256 totalAmount
    ) internal view returns (uint256[] memory) {
        uint256 numJoinSplits = bound(seed, 1, 5); // at most 5 joinsplits
        uint256[] memory joinSplitAmounts = new uint256[](numJoinSplits);

        uint256 remainingAmount = totalAmount;
        for (uint256 i = 0; i < numJoinSplits - 1; i++) {
            // Generate a random amount for the current join split and update the remaining amount
            uint256 randomAmount = bound(seed, 0, remainingAmount);
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
        uint256 numJoinSplits,
        uint256 maxNumRefunds
    ) internal pure returns (uint256) {
        return
            executionGasLimit +
            ((perJoinSplitVerifyGas + GAS_PER_JOINSPLIT_HANDLE) *
                numJoinSplits) +
            ((GAS_PER_REFUND_TREE + GAS_PER_REFUND_HANDLE) * maxNumRefunds);
    }
}
