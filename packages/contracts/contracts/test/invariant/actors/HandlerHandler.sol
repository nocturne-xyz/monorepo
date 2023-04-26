// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;
pragma abicoder v2;

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
import {OperationGenerator, GenerateOperationArgs, GeneratedOperationMetadata} from "../helpers/OperationGenerator.sol";
import {TokenIdSet, LibTokenIdSet} from "../helpers/TokenIdSet.sol";
import {Utils} from "../../../libs/Utils.sol";
import {AssetUtils} from "../../../libs/AssetUtils.sol";
import "../../../libs/Types.sol";

contract HandlerHandler is CommonBase, StdCheats, StdUtils {
    using LibTokenIdSet for TokenIdSet;

    address constant OWNER = address(0x1);

    Handler public handler;
    address subtreeBatchFiller;

    SimpleERC20Token public depositErc20;
    SimpleERC1155Token public depositErc1155;

    // ______PUBLIC______
    bytes32 public lastCall;
    mapping(bytes32 => uint256) public ghost_prefilledAssetBalances;

    // ______INTERNAL______
    mapping(bytes32 => uint256) internal _calls;
    TokenIdSet _depositErc1155IdSet;

    constructor(
        Handler _handler,
        address _subtreeBatchFiller,
        SimpleERC20Token _depositErc20,
        SimpleERC1155Token _depositErc1155
    ) {
        handler = _handler;
        subtreeBatchFiller = _subtreeBatchFiller;
        depositErc20 = _depositErc20;
        depositErc1155 = _depositErc1155;
    }

    modifier trackCall(bytes32 key) {
        lastCall = key;
        _;
        _calls[lastCall]++;
    }

    function callSummary() external view {
        console.log("-------------------");
        console.log("HandlerHandler call summary:");
        console.log("-------------------");
        console.log("addToAssetPrefill", _calls["addToAssetPrefill"]);
        console.log("fillBatchWithZeros", _calls["fillBatchWithZeros"]);
        console.log("-------------------");
        console.log(
            "Handler erc20 prefill",
            depositErc20.balanceOf(address(handler))
        );
        console.log("Handler erc1155 prefills");
        uint256[] memory ids = ghost_prefilledErc1155Ids();
        for (uint256 i = 0; i < ids.length; i++) {
            console.log(
                "Erc1155 id",
                ids[i],
                " -- balance",
                depositErc1155.balanceOf(address(handler), ids[i])
            );
        }
    }

    // ______EXTERNAL______
    function addToAssetPrefill(
        uint256 seed
    ) external trackCall("addToAssetPrefill") {
        uint256 assetType = bound(seed, 0, 1);

        vm.startPrank(OWNER);

        EncodedAsset memory encodedAsset;
        uint256 value;
        if (assetType == 0) {
            value = bound(
                seed,
                0,
                (type(uint256).max - depositErc20.totalSupply()) /
                    1_000_000_000_000
            );
            depositErc20.reserveTokens(OWNER, value);

            encodedAsset = AssetUtils.encodeAsset(
                AssetType.ERC20,
                address(depositErc20),
                NocturneUtils.ERC20_ID
            );

            AssetUtils.approveAsset(encodedAsset, address(handler), value);
        } else {
            value = bound(
                seed,
                0,
                (type(uint256).max - depositErc1155.totalSupply(seed)) /
                    1_000_000_000_000
            );
            depositErc1155.reserveTokens(OWNER, seed, value);

            encodedAsset = AssetUtils.encodeAsset(
                AssetType.ERC1155,
                address(depositErc1155),
                seed
            );

            AssetUtils.approveAsset(encodedAsset, address(handler), value);

            _depositErc1155IdSet.add(seed);
        }

        handler.addToAssetPrefill(encodedAsset, value);

        vm.stopPrank();

        bytes32 assetHash = AssetUtils.hashEncodedAsset(encodedAsset);
        ghost_prefilledAssetBalances[assetHash] += value;
    }

    function fillBatchWithZeros() external trackCall("fillBatchWithZeros") {
        if (handler.totalCount() - handler.count() != 0) {
            vm.prank(subtreeBatchFiller);
            handler.fillBatchWithZeros();
        } else {
            lastCall = "no-op";
        }
    }

    // ______VIEW______
    function ghost_prefilledErc1155Ids()
        public
        view
        returns (uint256[] memory)
    {
        return _depositErc1155IdSet.getIds();
    }
}
