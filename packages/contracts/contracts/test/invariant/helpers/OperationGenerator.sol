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
import {Wallet} from "../../../Wallet.sol";
import {Handler} from "../../../Handler.sol";
import {ParseUtils} from "../../utils/ParseUtils.sol";
import {EventParsing} from "../../utils/EventParsing.sol";
import {WETH9} from "../../tokens/WETH9.sol";
import {SimpleERC20Token} from "../../tokens/SimpleERC20Token.sol";
import {SimpleERC721Token} from "../../tokens/SimpleERC721Token.sol";
import {SimpleERC1155Token} from "../../tokens/SimpleERC1155Token.sol";
import {AddressSet, LibAddressSet} from "../helpers/AddressSet.sol";
import {DepositSumSet, LibDepositSumSet} from "../helpers/DepositSumSet.sol";
import {LibDepositRequestArray} from "../helpers/DepositRequestArray.sol";
import {Utils} from "../../../libs/Utils.sol";
import {AssetUtils} from "../../../libs/AssetUtils.sol";
import "../../../libs/Types.sol";

struct GenerateOperationArgs {
    uint256 seed;
    Wallet wallet;
    address handler;
    uint256 root;
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

    uint256 nullifierCount = 10;

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
            args.joinSplitToken.balanceOf(address(args.wallet))
        );

        // Get random args.joinSplitPublicSpends
        uint256[] memory joinSplitPublicSpends = _randomizeJoinSplitAmounts(
            args.seed,
            totalJoinSplitUnwrapAmount
        );

        // Get random numActions using the bound function, at least 2 to make space for token
        // approvals in case of a swap
        uint256 numActions = bound(args.seed, 2, 5);
        Action[] memory actions = new Action[](numActions);
        EncodedAsset[] memory encodedRefundAssets;

        _meta.transfers = new TransferRequest[](numActions);
        _meta.swaps = new SwapRequest[](numActions);
        _meta.isTransfer = new bool[](numActions);
        _meta.isSwap = new bool[](numActions);

        // For each action of numActions, switch on transfer vs swap
        uint256 runningJoinSplitAmount = totalJoinSplitUnwrapAmount; // TODO: subtract gas
        for (uint256 i = 0; i < numActions; i++) {
            bool isTransfer = bound(args.seed, 0, 1) == 0;
            uint256 joinSplitUseAmount = bound(
                args.seed,
                0,
                runningJoinSplitAmount
            );

            // Swap request requires two actions, if at end of array just fill with transfer and
            // use the rest
            if (i == numActions - 1) {
                isTransfer = true;
                joinSplitUseAmount = runningJoinSplitAmount;
            }

            runningJoinSplitAmount -= joinSplitUseAmount;

            if (isTransfer) {
                TransferRequest memory transferRequest = TransferRequest({
                    token: args.joinSplitToken,
                    recipient: address(0x3), // TODO: track recipient
                    amount: joinSplitUseAmount
                });
                actions[i] = NocturneUtils.formatTransferAction(
                    transferRequest
                );
                _meta.transfers[i] = transferRequest;
                _meta.isTransfer[i] = true;
            } else {
                SwapRequest memory swapRequest = _createRandomSwapRequest(
                    joinSplitUseAmount,
                    args
                );

                // Kludge to satisfy stack limit
                SimpleERC20Token inToken = args.joinSplitToken;
                TokenSwapper swapper = args.swapper;

                Action memory approveAction = Action({
                    contractAddress: address(inToken),
                    encodedFunction: abi.encodeWithSelector(
                        inToken.approve.selector,
                        address(swapper),
                        swapRequest.assetInAmount
                    )
                });
                actions[i] = approveAction;
                actions[i + 1] = Action({
                    contractAddress: address(swapper),
                    encodedFunction: abi.encodeWithSelector(
                        swapper.swap.selector,
                        swapRequest
                    )
                });

                _meta.swaps[i + 1] = swapRequest;
                _meta.isSwap[i + 1] = true;
                i += 1; // additional +1 to skip past swap action at i+1
            }
        }

        FormatOperationArgs memory opArgs = FormatOperationArgs({
            joinSplitToken: args.joinSplitToken,
            gasToken: args.gasToken,
            root: args.root,
            joinSplitPublicSpends: joinSplitPublicSpends,
            encodedRefundAssets: encodedRefundAssets,
            executionGasLimit: 5_000_000,
            maxNumRefunds: 20, // TODO: take based on number of swaps
            gasPrice: 0, // TODO: account for gas compensation
            actions: actions,
            atomicActions: true,
            operationFailureType: OperationFailureType.NONE
        });

        _op = NocturneUtils.formatOperation(opArgs);

        // Make sure nfs do not conflict. Doing here because doing in NocturneUtils would force us
        // to convert NocturneUtils to contract to inherit forge std
        for (uint256 i = 0; i < _op.joinSplits.length; i++) {
            // Overflow here doesn't matter given all we need are random nfs

            _op.joinSplits[i].nullifierA = nullifierCount;
            _op.joinSplits[i].nullifierB = nullifierCount + 1;

            nullifierCount += 2;

            console.log("NF A", _op.joinSplits[i].nullifierA);
            console.log("NF B", _op.joinSplits[i].nullifierB);
        }
    }

    function _createRandomSwapRequest(
        uint256 joinSplitUseAmount,
        GenerateOperationArgs memory args
    ) internal view returns (SwapRequest memory) {
        // Set encodedAssetIn as joinSplitToken
        EncodedAsset memory encodedAssetIn = AssetUtils.encodeAsset(
            AssetType.ERC20,
            address(args.joinSplitToken),
            ERC20_ID
        );

        uint256 swapErc20OutAmount = bound(
            args.seed,
            0,
            args.swapErc20.totalSupply()
        );
        uint256 swapErc721OutId = _getRandomErc721Id(
            args.swapErc721,
            args.seed
        );
        uint256 swapErc1155OutId = ERC20_ID;
        uint256 swapErc1155OutAmount = bound(args.seed, 0, 10_000_000);
        SwapRequest memory swapRequest = SwapRequest({
            assetInOwner: address(args.handler),
            encodedAssetIn: encodedAssetIn,
            assetInAmount: joinSplitUseAmount,
            erc20Out: address(args.swapErc20),
            erc20OutAmount: swapErc20OutAmount,
            erc721Out: address(args.swapErc721),
            erc721OutId: swapErc721OutId,
            erc1155Out: address(args.swapErc1155),
            erc1155OutId: swapErc1155OutId,
            erc1155OutAmount: swapErc1155OutAmount
        });

        return swapRequest;
    }

    function _randomizeJoinSplitAmounts(
        uint256 seed,
        uint256 totalAmount
    ) internal view returns (uint256[] memory) {
        uint256 numJoinSplits = bound(seed, 1, 8); // at most 8 joinsplits
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

    function _getRandomErc721Id(
        SimpleERC721Token erc721,
        uint256 seed
    ) internal view returns (uint256 _id) {
        for (uint256 j = 0; ; j++) {
            if (!erc721.exists(seed)) {
                _id = seed;
                break;
            }

            seed++;
        }
    }
}
