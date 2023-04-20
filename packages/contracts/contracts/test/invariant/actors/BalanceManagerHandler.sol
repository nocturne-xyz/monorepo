// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.17;

import "forge-std/Test.sol";
import {console} from "forge-std/console.sol";

import {TokenSwapper, SwapRequest} from "../../utils/TokenSwapper.sol";
import {TreeTest, TreeTestLib} from "../../utils/TreeTest.sol";
import {Wallet} from "../../../Wallet.sol";
import {Handler} from "../../../Handler.sol";
import {SimpleERC20Token} from "../../tokens/SimpleERC20Token.sol";
import {SimpleERC721Token} from "../../tokens/SimpleERC721Token.sol";
import {SimpleERC1155Token} from "../../tokens/SimpleERC1155Token.sol";
import {TestBalanceManager} from "../../harnesses/TestBalanceManager.sol";
import {OperationGenerator, GenerateOperationArgs, GeneratedOperationMetadata} from "../helpers/OperationGenerator.sol";
import "../../utils/NocturneUtils.sol";
import "../../../libs/Types.sol";

contract BalanceManagerHandler is OperationGenerator {
    // ______PUBLIC______
    Wallet public wallet;
    TestBalanceManager public balanceManager;
    TokenSwapper public swapper;

    SimpleERC20Token public joinSplitToken;
    SimpleERC20Token public gasToken;

    SimpleERC20Token public swapErc20;
    SimpleERC721Token public swapErc721;
    SimpleERC1155Token public swapErc1155;

    bytes32 public lastCall;

    // ______INTERNAL______
    mapping(bytes32 => uint256) internal _calls;

    constructor(
        Wallet _wallet,
        TestBalanceManager _balanceManager,
        TokenSwapper _swapper,
        SimpleERC20Token _joinSplitToken,
        SimpleERC20Token _gasToken,
        SimpleERC20Token _swapErc20,
        SimpleERC721Token _swapErc721,
        SimpleERC1155Token _swapErc1155
    ) {
        wallet = _wallet;
        balanceManager = _balanceManager;
        swapper = _swapper;
        joinSplitToken = _joinSplitToken;
        gasToken = _gasToken;
        swapErc20 = _swapErc20;
        swapErc721 = _swapErc721;
    }

    modifier trackCall(bytes32 key) {
        lastCall = key;
        _calls[key]++;
        _;
    }

    function callSummary() external view {
        console.log("-------------------");
        console.log("BalanceManagerHandler call summary:");
        console.log("-------------------");
        console.log("addToAssetPrefill", _calls["addToAssetPrefill"]);
        console.log("handleDeposit", _calls["handleDeposit"]);
        console.log(
            "processJoinSplitsReservingFee",
            _calls["processJoinSplitsReservingFee"]
        );
        console.log(
            "gatherReservedGasAndPayBundler",
            _calls["gatherReservedGasAndPayBundler"]
        );
        console.log("handleAllRefunds", _calls["handleAllRefunds"]);
    }

    function addToAssetPrefill(
        EncodedAsset calldata encodedAsset,
        uint256 value
    ) public trackCall("addToAssetPrefill") {
        balanceManager.addToAssetPrefill(encodedAsset, value);
    }

    // function handleDeposit(
    //     DepositRequest calldata deposit
    // ) public trackCall("handleDeposit") {
    //     testBalanceManager.handleDeposit(deposit);
    // }

    // function processJoinSplitsReservingFee(
    //     Operation calldata op,
    //     uint256 perJoinSplitVerifyGas
    // ) public trackCall("processJoinSplitsReservingFee") {
    //     testBalanceManager.processJoinSplitsReservingFee(
    //         op,
    //         perJoinSplitVerifyGas
    //     );
    // }

    // function gatherReservedGasAndPayBundler(
    //     Operation calldata op,
    //     OperationResult memory opResult,
    //     uint256 perJoinSplitVerifyGas,
    //     address bundler
    // ) public trackCall("gatherReservedGasAndPayBundler") {
    //     testBalanceManager.gatherReservedGasAssetAndPayBundler(
    //         op,
    //         opResult,
    //         perJoinSplitVerifyGas,
    //         bundler
    //     );
    // }

    // function handleAllRefunds(
    //     uint256 seed
    // ) public trackCall("handleAllRefunds") {
    //     (
    //         Operation memory op,
    //         GeneratedOperationMetadata memory meta
    //     ) = _generateRandomOperation(
    //             GenerateOperationArgs({
    //                 seed: seed,
    //                 wallet: wallet,
    //                 handler: address(balanceManager),
    //                 root: balanceManager.root(),
    //                 swapper: swapper,
    //                 joinSplitToken: joinSplitToken,
    //                 gasToken: gasToken,
    //                 swapErc20: swapErc20,
    //                 swapErc721: swapErc721,
    //                 swapErc1155: swapErc1155
    //             })
    //         );

    //     balanceManager.handleAllRefunds(op);
    // }
}
