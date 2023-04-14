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
    Handler handler;
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
}

contract OperationGenerator is CommonBase, StdCheats, StdUtils {
    uint256 constant ERC20_ID = 0;

    function _generateRandomOperation(
        GenerateOperationArgs memory args
    )
        internal
        view
        returns (Operation memory _op, GeneratedOperationMetadata memory _meta)
    {
        // Calculate totalJoinSplitUnwrapAmount using the bound function
        uint256 totalJoinSplitUnwrapAmount = bound(
            args.seed,
            0,
            args.joinSplitToken.balanceOf(address(args.wallet))
        );

        // Pick handler.root() as args.root
        uint256 root = args.handler.root();

        // Calculate args.joinSplitPublicSpends
        uint256[] memory joinSplitPublicSpends = _randomizeJoinSplitAmounts(
            args.seed,
            totalJoinSplitUnwrapAmount
        );

        // Calculate numActions using the bound function, at least 2 to make space for token
        // approvals in case of a swap
        uint256 numActions = bound(args.seed, 2, 5);
        Action[] memory actions = new Action[](numActions);
        EncodedAsset[] memory encodedRefundAssets;

        _meta.transfers = new TransferRequest[](numActions);
        _meta.swaps = new SwapRequest[](numActions);
        _meta.isTransfer = new bool[](numActions);

        // For each action of numActions, switch on transfer vs swap
        uint256 runningJoinSplitAmount = totalJoinSplitUnwrapAmount; // TODO: subtract gas
        for (uint256 i = 0; i < numActions; i++) {
            console.log("top of loop");
            // bool isTransfer = bound(args.seed, 0, 1) == 0;
            bool isTransfer = false;

            // Swap request requires two actions, if at end of array just fill with transfer
            if (i + 1 == numActions) {
                isTransfer = true;
            }

            uint256 joinSplitUseAmount = bound(
                args.seed,
                0,
                runningJoinSplitAmount
            );

            console.log("runningJoinSplitAmount -= joinSplitUseAmount");
            runningJoinSplitAmount -= joinSplitUseAmount;
            console.log("[DONE] runningJoinSplitAmount -= joinSplitUseAmount");

            if (isTransfer) {
                TransferRequest memory transferRequest = TransferRequest({
                    token: args.joinSplitToken,
                    recipient: address(0x3), // TODO: track recipient
                    amount: joinSplitUseAmount
                });
                console.log("NocturneUtils.formatTransferAction");
                actions[i] = NocturneUtils.formatTransferAction(
                    transferRequest
                );
                console.log("[DONE] _createRandomSwapRequest");
                _meta.transfers[i] = transferRequest;
                _meta.isTransfer[i] = true;
                console.log("[DONE] _meta.transfers[i] = transferRequest");
            } else {
                console.log("_createRandomSwapRequest");
                SwapRequest memory swapRequest = _createRandomSwapRequest(
                    joinSplitUseAmount,
                    args
                );
                console.log("[DONE] _createRandomSwapRequest");

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
                _meta.swaps[i] = swapRequest;
                i += 1; // additional +1
            }
        }

        FormatOperationArgs memory opArgs = FormatOperationArgs({
            joinSplitToken: args.joinSplitToken,
            gasToken: args.gasToken,
            root: root,
            joinSplitPublicSpends: joinSplitPublicSpends,
            encodedRefundAssets: encodedRefundAssets,
            executionGasLimit: 5_000_000,
            maxNumRefunds: 20, // TODO: take based on number of swaps
            gasPrice: 0, // TODO: account for gas compensation
            actions: actions,
            atomicActions: true,
            operationFailureType: OperationFailureType.NONE
        });

        console.log("NocturneUtils.formatOperation(opArgs)");
        _op = NocturneUtils.formatOperation(opArgs);

        // Make sure nfs do not conflict. Doing here because doing in NocturneUtils would force us
        // to convert NocturneUtils to contract to inherit forge std
        console.log("Randomizing nfs");
        for (uint256 i = 0; i < _op.joinSplits.length; i++) {
            // Overflow here doesn't matter given all we need are random nfs
            unchecked {
                _op.joinSplits[i].nullifierA = args.seed + (2 * i);
                _op.joinSplits[i].nullifierB = args.seed + (2 * i) + 1;
            }
        }
        console.log("[DONE] Randomizing nfs");
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
            assetInAmount: 1000,
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
            console.log(randomAmount);
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
