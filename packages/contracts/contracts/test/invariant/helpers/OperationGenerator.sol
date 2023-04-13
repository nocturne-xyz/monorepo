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

struct GenerateRandomOperationArgs {
    uint256 seed;
    Wallet wallet;
    Handler handler;
    TokenSwapper swapper;
    SimpleERC20Token joinSplitToken;
    SimpleERC20Token gasToken;
    SimpleERC20Token erc20;
    SimpleERC721Token erc721;
    SimpleERC1155Token erc1155;
}

contract OperationGenerator is CommonBase, StdCheats, StdUtils {
    uint256 constant ERC20_ID = 0;

    function generateRandomOperation(
        GenerateRandomOperationArgs memory args
    ) public view returns (Operation memory) {
        // Step 2: Calculate totalJoinSplitUnwrapAmount using the bound function
        uint256 totalJoinSplitUnwrapAmount = bound(
            args.seed,
            0,
            args.joinSplitToken.balanceOf(address(args.wallet))
        );

        // Step 4: Pick handler.root() as args.root
        uint256 root = args.handler.root();

        // Step 5: Calculate args.joinSplitPublicSpends
        uint256[] memory joinSplitPublicSpends = _randomizeJoinSplitAmounts(
            args.seed,
            totalJoinSplitUnwrapAmount
        );

        // Step 6: Calculate numActions using the bound function
        uint256 numActions = bound(args.seed, 1, 10);

        Action[] memory actions = new Action[](numActions);
        EncodedAsset[] memory encodedRefundAssets;

        // Step 7: For each action of numActions, switch on transfer vs swap
        uint256 runningJoinSplitAmount = totalJoinSplitUnwrapAmount; // TODO: subtract gas
        for (uint256 i = 0; i < numActions; i++) {
            bool isTransfer = bound(args.seed, 0, 1) == 0;
            uint256 joinSplitUseAmount = bound(
                args.seed,
                0,
                runningJoinSplitAmount
            );
            runningJoinSplitAmount -= joinSplitUseAmount;

            if (isTransfer) {
                actions[i] = NocturneUtils.formatTransferAction(
                    args.joinSplitToken,
                    address(args.wallet),
                    joinSplitUseAmount
                );
            } else {
                SwapRequest memory swapRequest = _createRandomSwapRequest(
                    joinSplitUseAmount,
                    args
                );
                actions[i] = Action({
                    contractAddress: address(args.swapper),
                    encodedFunction: abi.encodeWithSelector(
                        args.swapper.swap.selector,
                        swapRequest
                    )
                });
            }
        }

        FormatOperationArgs memory opArgs = FormatOperationArgs({
            joinSplitToken: args.joinSplitToken,
            gasToken: args.gasToken,
            root: root,
            joinSplitPublicSpends: joinSplitPublicSpends,
            encodedRefundAssets: encodedRefundAssets,
            executionGasLimit: 5_000_000,
            maxNumRefunds: 0,
            gasPrice: 0,
            actions: actions,
            atomicActions: false,
            operationFailureType: OperationFailureType.NONE
        });

        return NocturneUtils.formatOperation(opArgs);
    }

    function _createRandomSwapRequest(
        uint256 joinSplitUseAmount,
        GenerateRandomOperationArgs memory args
    ) internal view returns (SwapRequest memory) {
        // Set encodedAssetIn as joinSplitToken
        EncodedAsset memory encodedAssetIn = AssetUtils.encodeAsset(
            AssetType.ERC20,
            address(args.joinSplitToken),
            ERC20_ID
        );

        uint256 erc20OutAmount = bound(args.seed, 0, args.erc20.totalSupply());
        uint256 erc721OutId = _getRandomErc721Id(args.erc721, args.seed);
        uint256 erc1155OutId = ERC20_ID;
        uint256 erc1155OutAmount = bound(args.seed, 0, 10_000_000);

        SwapRequest memory swapRequest = SwapRequest({
            assetInOwner: address(args.wallet),
            encodedAssetIn: encodedAssetIn,
            assetInAmount: joinSplitUseAmount,
            erc20Out: address(args.erc20),
            erc20OutAmount: erc20OutAmount,
            erc721Out: address(args.erc721),
            erc721OutId: erc721OutId,
            erc1155Out: address(args.erc1155),
            erc1155OutId: erc1155OutId,
            erc1155OutAmount: erc1155OutAmount
        });

        return swapRequest;
    }

    function _randomizeJoinSplitAmounts(
        uint256 seed,
        uint256 totalAmount
    ) internal view returns (uint256[] memory) {
        uint256 numJoinSplits = bound(seed, 1, 10); // You can change the bounds as needed
        uint256[] memory joinSplitAmounts = new uint256[](numJoinSplits);

        uint256 remainingAmount = totalAmount;
        for (uint256 i = 0; i < numJoinSplits - 1; i++) {
            // Generate a random amount for the current join split and update the remaining amount
            uint256 randomAmount = bound(seed + i, 0, remainingAmount);
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
            uint256 maybeId = bound(seed, 0, type(uint256).max - 1);

            if (!erc721.exists(maybeId)) {
                _id = maybeId;
                break;
            }

            seed++;
        }
    }
}
