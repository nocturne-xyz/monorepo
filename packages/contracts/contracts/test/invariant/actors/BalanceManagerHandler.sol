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
import {AssetUtils} from "../../../libs/AssetUtils.sol";
import "../../utils/NocturneUtils.sol";
import "../../../libs/Types.sol";

import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {IERC1155Receiver, IERC165} from "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";

contract BalanceManagerHandler is
    OperationGenerator,
    IERC721Receiver,
    IERC1155Receiver
{
    uint256 constant OPERATION_STAGE_SLOT = 174;
    uint256 constant ENTERED_PREFILL = 2;

    // ______PUBLIC______
    Wallet public wallet;
    TestBalanceManager public balanceManager;
    TokenSwapper public swapper;

    SimpleERC20Token public depositErc20;
    SimpleERC721Token public depositErc721;
    SimpleERC1155Token public depositErc1155;

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
        SimpleERC20Token _depositErc20,
        SimpleERC721Token _depositErc721,
        SimpleERC1155Token _depositErc1155,
        SimpleERC20Token _swapErc20,
        SimpleERC721Token _swapErc721,
        SimpleERC1155Token _swapErc1155
    ) {
        wallet = _wallet;
        balanceManager = _balanceManager;
        swapper = _swapper;
        depositErc20 = _depositErc20;
        depositErc721 = _depositErc721;
        depositErc1155 = _depositErc1155;
        swapErc20 = _swapErc20;
        swapErc721 = _swapErc721;
        swapErc1155 = _swapErc1155;
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
        uint256 seed
    ) public trackCall("addToAssetPrefill") {
        uint256 assetType = bound(seed, 0, 1);

        vm.store(
            address(balanceManager),
            bytes32(OPERATION_STAGE_SLOT),
            bytes32(ENTERED_PREFILL)
        );

        EncodedAsset memory encodedAsset;
        uint256 value;
        if (assetType == 0) {
            value = bound(seed, 0, 1_000_000); // TODO: make these bounds better
            depositErc20.reserveTokens(address(this), value);

            encodedAsset = AssetUtils.encodeAsset(
                AssetType.ERC20,
                address(depositErc20),
                ERC20_ID
            );

            AssetUtils.approveAsset(
                encodedAsset,
                address(balanceManager),
                value
            );
        } else {
            value = bound(seed, 0, 1_000_000);
            depositErc1155.reserveTokens(address(this), seed, value);

            encodedAsset = AssetUtils.encodeAsset(
                AssetType.ERC1155,
                address(depositErc1155),
                seed
            );
            console.log("seed id", seed);
            console.log("AssetUtils decoded id", encodedAsset.encodedAssetId);

            AssetUtils.approveAsset(
                encodedAsset,
                address(balanceManager),
                value + 1
            );
        }
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

    function onERC721Received(
        address, // operator
        address, // from
        uint256, // tokenId
        bytes calldata // data
    ) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    function onERC1155Received(
        address, // operator
        address, // from
        uint256, // id
        uint256, // value
        bytes calldata // data
    ) external pure override returns (bytes4) {
        return IERC1155Receiver.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address, // operator
        address, // from
        uint256[] calldata, // ids
        uint256[] calldata, // values
        bytes calldata // data
    ) external pure override returns (bytes4) {
        return IERC1155Receiver.onERC1155BatchReceived.selector;
    }

    function supportsInterface(
        bytes4 interfaceId
    ) external pure override returns (bool) {
        return
            (interfaceId == type(IERC165).interfaceId) ||
            (interfaceId == type(IERC721Receiver).interfaceId) ||
            (interfaceId == type(IERC1155Receiver).interfaceId);
    }
}
