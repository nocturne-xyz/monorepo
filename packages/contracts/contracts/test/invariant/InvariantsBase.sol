// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {Test} from "forge-std/Test.sol";
import {console} from "forge-std/console.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";

import {DepositManagerHandler} from "./actors/DepositManagerHandler.sol";
import {WalletHandler} from "./actors/WalletHandler.sol";
import {HandlerHandler} from "./actors/HandlerHandler.sol";
import {TokenSwapper, SwapRequest} from "../utils/TokenSwapper.sol";
import {TestJoinSplitVerifier} from "../harnesses/TestJoinSplitVerifier.sol";
import {TestSubtreeUpdateVerifier} from "../harnesses/TestSubtreeUpdateVerifier.sol";
import "../utils/NocturneUtils.sol";
import {TestDepositManager} from "../harnesses/TestDepositManager.sol";
import {Wallet} from "../../Wallet.sol";
import {Handler} from "../../Handler.sol";
import {ParseUtils} from "../utils/ParseUtils.sol";
import {EventParsing} from "../utils/EventParsing.sol";
import {WETH9} from "../tokens/WETH9.sol";
import {SimpleERC20Token} from "../tokens/SimpleERC20Token.sol";
import {SimpleERC721Token} from "../tokens/SimpleERC721Token.sol";
import {SimpleERC1155Token} from "../tokens/SimpleERC1155Token.sol";
import {Utils} from "../../libs/Utils.sol";
import "../../libs/Types.sol";

contract InvariantsBase is Test {
    string constant CONTRACT_NAME = "NocturneDepositManager";
    string constant CONTRACT_VERSION = "v1";
    address constant OWNER = address(0x1);
    address constant SUBTREE_BATCH_FILLER_ADDRESS = address(0x2);
    uint256 constant SCREENER_PRIVKEY = 1;
    address SCREENER_ADDRESS = vm.addr(SCREENER_PRIVKEY);

    DepositManagerHandler public depositManagerHandler;
    WalletHandler public walletHandler;
    HandlerHandler public handlerHandler;

    Wallet public wallet;
    Handler public handler;
    TestDepositManager public depositManager;

    TokenSwapper public swapper;

    WETH9 public weth;
    SimpleERC20Token public depositErc20;
    SimpleERC721Token public depositErc721;
    SimpleERC1155Token public depositErc1155;
    SimpleERC20Token public swapErc20;
    SimpleERC721Token public swapErc721;
    SimpleERC1155Token public swapErc1155;

    function print_callSummary() internal view {
        depositManagerHandler.callSummary();
        walletHandler.callSummary();
        handlerHandler.callSummary();
    }

    // _______________PROTOCOL_WIDE_______________

    function assert_protocol_walletBalanceEqualsCompletedDepositSumMinusTransferedOutPlusBundlerPayoutErc20()
        internal
    {
        assertEq(
            depositManagerHandler.erc20().balanceOf(address(wallet)),
            depositManagerHandler.ghost_completeDepositSumErc20() -
                walletHandler.ghost_totalTransferredOutOfWallet() -
                walletHandler.ghost_totalBundlerPayout()
        );
    }

    function assert_protocol_handlerAlwaysEndsWithPrefillBalances() internal {
        // ERC20 prefills left in handler
        bytes32 hashedErc20 = AssetUtils.hashEncodedAsset(
            AssetUtils.encodeAsset(
                AssetType.ERC20,
                address(depositErc20),
                uint256(AssetType.ERC20)
            )
        );
        assertEq(
            depositErc20.balanceOf(address(handler)),
            handlerHandler.handler()._prefilledAssetBalances(hashedErc20)
        );

        // ERC1155 prefills left in handler
        uint256[] memory erc1155Ids = handlerHandler
            .ghost_prefilledErc1155Ids();
        for (uint256 i = 0; i < erc1155Ids.length; i++) {
            bytes32 hashedErc1155 = AssetUtils.hashEncodedAsset(
                AssetUtils.encodeAsset(
                    AssetType.ERC1155,
                    address(depositErc1155),
                    erc1155Ids[i]
                )
            );
            assertEq(
                depositErc1155.balanceOf(address(handler), erc1155Ids[i]),
                handlerHandler.handler()._prefilledAssetBalances(hashedErc1155)
            );
        }
    }

    // _______________DEPOSIT_ETH_______________

    function assert_deposit_outNeverExceedsInETH() internal {
        assertGe(
            depositManagerHandler.ghost_instantiateDepositSumETH(),
            depositManagerHandler.ghost_retrieveDepositSumETH() +
                depositManagerHandler.ghost_completeDepositSumETH()
        );
    }

    function assert_deposit_depositManagerBalanceEqualsInMinusOutETH()
        internal
    {
        assertEq(
            weth.balanceOf(address(depositManagerHandler.depositManager())),
            depositManagerHandler.ghost_instantiateDepositSumETH() -
                depositManagerHandler.ghost_retrieveDepositSumETH() -
                depositManagerHandler.ghost_completeDepositSumETH()
        );
    }

    function assert_deposit_walletBalanceEqualsCompletedDepositSumETH()
        internal
    {
        assertEq(
            weth.balanceOf(address(wallet)),
            depositManagerHandler.ghost_completeDepositSumETH()
        );
    }

    function assert_deposit_allActorsBalanceSumETHEqualsRetrieveDepositSumETH()
        internal
    {
        address[] memory allActors = depositManagerHandler.ghost_AllActors();

        uint256 sum = 0;
        for (uint256 i = 0; i < allActors.length; i++) {
            sum += weth.balanceOf(allActors[i]);
        }

        assertEq(sum, depositManagerHandler.ghost_retrieveDepositSumETH());
    }

    function assert_deposit_actorBalanceAlwaysEqualsRetrievedETH() internal {
        address[] memory allActors = depositManagerHandler.ghost_AllActors();

        for (uint256 i = 0; i < allActors.length; i++) {
            assertEq(
                weth.balanceOf(allActors[i]),
                depositManagerHandler.ghost_retrieveDepositSumETHFor(
                    allActors[i]
                )
            );
        }
    }

    function assert_deposit_actorBalanceNeverExceedsInstantiatedETH() internal {
        address[] memory allActors = depositManagerHandler.ghost_AllActors();

        for (uint256 i = 0; i < allActors.length; i++) {
            assertLe(
                weth.balanceOf(allActors[i]),
                depositManagerHandler.ghost_instantiateDepositSumETHFor(
                    allActors[i]
                )
            );
        }
    }

    // _______________DEPOSIT_ERC20_______________

    function assert_deposit_outNeverExceedsInErc20() internal {
        assertGe(
            depositManagerHandler.ghost_instantiateDepositSumErc20(),
            depositManagerHandler.ghost_retrieveDepositSumErc20() +
                depositManagerHandler.ghost_completeDepositSumErc20()
        );
    }

    function assert_deposit_depositManagerBalanceEqualsInMinusOutErc20()
        internal
    {
        assertEq(
            depositManagerHandler.erc20().balanceOf(
                address(depositManagerHandler.depositManager())
            ),
            depositManagerHandler.ghost_instantiateDepositSumErc20() -
                depositManagerHandler.ghost_retrieveDepositSumErc20() -
                depositManagerHandler.ghost_completeDepositSumErc20()
        );
    }

    function assert_deposit_allActorsBalanceSumErc20EqualsRetrieveDepositSumErc20()
        internal
    {
        address[] memory allActors = depositManagerHandler.ghost_AllActors();

        uint256 sum = 0;
        for (uint256 i = 0; i < allActors.length; i++) {
            sum += depositManagerHandler.erc20().balanceOf(allActors[i]);
        }

        assertEq(sum, depositManagerHandler.ghost_retrieveDepositSumErc20());
    }

    function assert_deposit_actorBalanceAlwaysEqualsRetrievedErc20() internal {
        address[] memory allActors = depositManagerHandler.ghost_AllActors();

        for (uint256 i = 0; i < allActors.length; i++) {
            assertEq(
                depositManagerHandler.erc20().balanceOf(allActors[i]),
                depositManagerHandler.ghost_retrieveDepositSumErc20For(
                    allActors[i]
                )
            );
        }
    }

    function assert_deposit_actorBalanceNeverExceedsInstantiatedErc20()
        internal
    {
        address[] memory allActors = depositManagerHandler.ghost_AllActors();

        for (uint256 i = 0; i < allActors.length; i++) {
            assertLe(
                depositManagerHandler.erc20().balanceOf(allActors[i]),
                depositManagerHandler.ghost_instantiateDepositSumErc20For(
                    allActors[i]
                )
            );
        }
    }

    // _______________OPERATIONS_______________

    function assert_operation_totalSwapErc20ReceivedMatchesWalletBalance()
        internal
    {
        assertEq(
            swapErc20.balanceOf(address(wallet)),
            walletHandler.ghost_totalSwapErc20Received()
        );
    }

    function assert_operation_walletOwnsAllSwapErc721s() internal {
        uint256[] memory ids = walletHandler.ghost_swapErc721IdsReceived();
        for (uint256 i = 0; i < ids.length; i++) {
            assertEq(address(wallet), swapErc721.ownerOf(ids[i]));
        }
    }

    function assert_operation_totalSwapErc1155ReceivedMatchesWalletBalance()
        internal
    {
        uint256[] memory ids = walletHandler.ghost_swapErc1155IdsReceived();
        for (uint256 i = 0; i < ids.length; i++) {
            uint256 id = ids[i];
            assertEq(
                swapErc1155.balanceOf(address(wallet), id),
                walletHandler.ghost_totalSwapErc1155ReceivedForId(id)
            );
        }
    }

    function assert_operation_bundlerBalanceMatchesTracked() internal {
        assertEq(
            depositErc20.balanceOf(address(walletHandler.BUNDLER_ADDRESS())),
            walletHandler.ghost_totalBundlerPayout()
        );
    }
}
