// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {Test} from "forge-std/Test.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";
import {console} from "forge-std/console.sol";

import {Wallet} from "../../Wallet.sol";
import {TokenSwapper, SwapRequest} from "../utils/TokenSwapper.sol";
import {BalanceManagerHandler} from "./actors/BalanceManagerHandler.sol";
import {TestBalanceManager} from "../harnesses/TestBalanceManager.sol";
import {TestSubtreeUpdateVerifier} from "../harnesses/TestSubtreeUpdateVerifier.sol";
import {TestJoinSplitVerifier} from "../harnesses/TestJoinSplitVerifier.sol";
import {SimpleERC20Token} from "../tokens/SimpleERC20Token.sol";
import {SimpleERC721Token} from "../tokens/SimpleERC721Token.sol";
import {SimpleERC1155Token} from "../tokens/SimpleERC1155Token.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {TreeUtils} from "../../libs/TreeUtils.sol";
import {AssetUtils} from "../../libs/AssetUtils.sol";
import "../../libs/Types.sol";
import "./helpers/BalanceManagerOpUtils.sol";

contract BalanceManagerInvariants is Test {
    using OperationLib for Operation;

    Wallet public wallet;

    BalanceManagerHandler public balanceManagerHandler;

    TokenSwapper public swapper;

    SimpleERC20Token public depositErc20;
    SimpleERC721Token public depositErc721;
    SimpleERC1155Token public depositErc1155;
    SimpleERC20Token public swapErc20;
    SimpleERC721Token public swapErc721;
    SimpleERC1155Token public swapErc1155;

    bytes32 public depositErc20Hash;
    bytes32 public depositErc1155Hash;

    function setUp() public virtual {
        wallet = new Wallet();
        TestBalanceManager balanceManager = new TestBalanceManager();

        TestJoinSplitVerifier joinSplitVerifier = new TestJoinSplitVerifier();
        TestSubtreeUpdateVerifier subtreeUpdateVerifier = new TestSubtreeUpdateVerifier();

        balanceManager.initialize(
            address(wallet),
            address(subtreeUpdateVerifier)
        );
        wallet.initialize(address(balanceManager), address(joinSplitVerifier));

        // wallet.setDepositSourcePermission(address(depositManager), true);

        depositErc20 = new SimpleERC20Token();
        depositErc721 = new SimpleERC721Token();
        depositErc1155 = new SimpleERC1155Token();

        swapper = new TokenSwapper();
        swapErc20 = new SimpleERC20Token();
        swapErc721 = new SimpleERC721Token();
        swapErc1155 = new SimpleERC1155Token();

        balanceManagerHandler = new BalanceManagerHandler(
            wallet,
            balanceManager,
            swapper,
            depositErc20,
            depositErc721,
            depositErc1155,
            swapErc20,
            swapErc721,
            swapErc1155
        );

        bytes4[] memory selectors = new bytes4[](1);
        selectors[0] = balanceManagerHandler.call.selector;

        targetContract(address(balanceManagerHandler));
        targetSelector(
            FuzzSelector({
                addr: address(balanceManagerHandler),
                selectors: selectors
            })
        );
    }

    function invariant_callSummary() public view {
        balanceManagerHandler.callSummary();
    }

    function invariant_consistentTokenBalances() external {
        bytes32 lastCall = balanceManagerHandler.lastCall();
        if (lastCall == "addToAssetPrefill") {
            // BalanceManager erc20s match prefills
            uint256 erc20Prefill = balanceManagerHandler.prefilledAssetBalances(
                AssetUtils.hashEncodedAsset(
                    AssetUtils.encodeAsset(
                        AssetType.ERC20,
                        address(depositErc20),
                        uint256(AssetType.ERC20)
                    )
                )
            );
            assertEq(
                erc20Prefill,
                depositErc20.balanceOf(
                    address(balanceManagerHandler.balanceManager())
                )
            );

            // BalanceManager erc1155s match prefills
            uint256[] memory erc1155Ids = balanceManagerHandler
                .ghost_prefilledErc1155Ids();
            for (uint256 i = 0; i < erc1155Ids.length; i++) {
                uint256 erc1155Prefill = balanceManagerHandler
                    .prefilledAssetBalances(
                        AssetUtils.hashEncodedAsset(
                            AssetUtils.encodeAsset(
                                AssetType.ERC1155,
                                address(depositErc1155),
                                erc1155Ids[i]
                            )
                        )
                    );
                assertEq(
                    erc1155Prefill,
                    depositErc1155.balanceOf(
                        address(balanceManagerHandler.balanceManager()),
                        erc1155Ids[i]
                    )
                );
            }
        } else if (lastCall == "processJoinSplitsReservingFee") {
            Operation memory op = balanceManagerHandler
                .ghost_lastProcessedOperation();
            EncodedAssetPublicSpend[]
                memory assetPublicSpends = BalanceManagerOpUtils
                    .extractAssetsAndTotalPublicSpend(op.joinSplits);

            for (uint256 i = 0; i < assetPublicSpends.length; i++) {
                EncodedAssetPublicSpend
                    memory assetPublicSpend = assetPublicSpends[i];
                (
                    AssetType decodedAssetType,
                    address decodedAssetAddr,
                    uint256 decodedId
                ) = AssetUtils.decodeAsset(assetPublicSpend.encodedAsset);

                if (decodedAssetType == AssetType.ERC20) {
                    assertEq(
                        assetPublicSpend.publicSpend,
                        IERC20(decodedAssetAddr).balanceOf(address(wallet))
                    );
                } else if (decodedAssetType == AssetType.ERC721) {
                    assertEq(
                        address(balanceManagerHandler.balanceManager()),
                        IERC721(decodedAssetAddr).ownerOf(decodedId)
                    );
                } else if (decodedAssetType == AssetType.ERC1155) {
                    assertEq(
                        assetPublicSpend.publicSpend,
                        IERC1155(decodedAssetAddr).balanceOf(
                            address(wallet),
                            decodedId
                        )
                    );
                }
            }
        } else if (lastCall == "gatherReservedGasAndPayBundler") {
            Operation memory op = balanceManagerHandler
                .ghost_lastProcessedOperation();
            OperationResult memory opResult = balanceManagerHandler
                .ghost_lastOperationResult();

            uint256 reserved = balanceManagerHandler
                .balanceManager()
                .calculateOpMaxGasAssetCost(op, PER_JOINSPLIT_VERIFY_GAS);
            uint256 bundlerPayout = balanceManagerHandler
                .balanceManager()
                .calculateBundlerGasAssetPayout(op, opResult);
            uint256 expectedInBalanceManager = reserved - bundlerPayout;

            (
                AssetType decodedAssetType,
                address decodedAssetAddr,
                uint256 decodedId
            ) = AssetUtils.decodeAsset(op.encodedGasAsset);

            assertEq(
                expectedInBalanceManager,
                IERC20(decodedAssetAddr).balanceOf(
                    address(balanceManagerHandler.balanceManager())
                )
            );
        }
    }
}
