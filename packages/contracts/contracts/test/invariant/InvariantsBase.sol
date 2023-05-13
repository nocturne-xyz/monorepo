// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {Test} from "forge-std/Test.sol";
import {console} from "forge-std/console.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";

import {DepositManagerHandler} from "./actors/DepositManagerHandler.sol";
import {TellerHandler} from "./actors/TellerHandler.sol";
import {HandlerHandler} from "./actors/HandlerHandler.sol";
import {TokenSwapper, SwapRequest} from "../utils/TokenSwapper.sol";
import {TestJoinSplitVerifier} from "../harnesses/TestJoinSplitVerifier.sol";
import {TestSubtreeUpdateVerifier} from "../harnesses/TestSubtreeUpdateVerifier.sol";
import "../utils/NocturneUtils.sol";
import {TestDepositManager} from "../harnesses/TestDepositManager.sol";
import {Teller} from "../../Teller.sol";
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
    address constant BUNDLER_ADDRESS = address(0x3);
    address constant TRANSFER_RECIPIENT_ADDRESS = address(0x4);

    uint256 constant SCREENER_PRIVKEY = 1;
    address SCREENER_ADDRESS = vm.addr(SCREENER_PRIVKEY);

    DepositManagerHandler public depositManagerHandler;
    TellerHandler public tellerHandler;
    HandlerHandler public handlerHandler;

    Teller public teller;
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
        tellerHandler.callSummary();
        handlerHandler.callSummary();
    }

    // _______________PROTOCOL_WIDE_______________

    function assert_protocol_tellerBalanceEqualsCompletedDepositSumMinusTransferedOutPlusBundlerPayoutErc20()
        internal
    {
        // Actual balance
        uint256 tellerBalance = depositManagerHandler.erc20().balanceOf(
            address(teller)
        );

        // Amount if no prefills were withheld
        uint256 joinSplitTokenBalanceNoPrefills = depositManagerHandler
            .ghost_completeDepositSumErc20() -
            tellerHandler.ghost_totalTransferredOutOfTeller() -
            tellerHandler.ghost_totalBundlerPayout();

        // Balance if all possible prefills withheld
        uint256 maxPrefillAmount = tellerHandler
            .ghost_joinSplitTokenPrefilled();
        uint256 joinSplitTokenBalanceWithAllPrefills = joinSplitTokenBalanceNoPrefills >=
                maxPrefillAmount
                ? joinSplitTokenBalanceNoPrefills - maxPrefillAmount
                : joinSplitTokenBalanceNoPrefills; // avoid underflow

        // Assert actual balance is at most expected with no prefills
        assertLe(tellerBalance, joinSplitTokenBalanceNoPrefills);
        assertGe(tellerBalance, joinSplitTokenBalanceWithAllPrefills);
    }

    // TODO: replace prefill balances check with check handler always ends with balances 0 or 1

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

    function assert_deposit_tellerBalanceEqualsCompletedDepositSumETH()
        internal
    {
        assertEq(
            weth.balanceOf(address(teller)),
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

    function assert_deposit_screenerBalanceInBounds() internal {
        assertLe(
            SCREENER_ADDRESS.balance,
            depositManagerHandler.ghost_totalSuppliedGasCompensation()
        );
    }

    function assert_deposit_actorBalancesInBounds() internal {
        address[] memory allActors = depositManagerHandler.ghost_AllActors();

        for (uint256 i = 0; i < allActors.length; i++) {
            uint256 actorBalance = allActors[i].balance;
            uint256 actorBalanceCap = depositManagerHandler
                .ghost_totalSuppliedGasCompensationFor(allActors[i]);

            // NOTE: This invariant kept failing even though I checked all actor balances via
            // logs and only found balance == ghost var but never greater than. I suspect there
            // is a bug somewhere in foundry that doesn't like assertLe(0, 0) so hardcoding a
            // statement here.
            if (actorBalanceCap == actorBalance) {
                continue;
            }

            if (actorBalance > actorBalanceCap) {
                revert("actor balance exceeds expected cap");
            }
        }
    }

    // _______________OPERATIONS_______________

    function assert_operation_totalSwapErc20ReceivedMatchesTellerBalance()
        internal
    {
        // Actual balance
        uint256 tellerBalance = swapErc20.balanceOf(address(teller));

        // Amount if no prefills were withheld
        uint256 swapErc20BalanceNoPrefills = tellerHandler
            .ghost_totalSwapErc20Received();

        assertLe(tellerBalance, swapErc20BalanceNoPrefills);

        // // Balance if all possible prefills withheld
        // uint256 maxPrefillAmount = tellerHandler.ghost_swapErc20Prefilled();
        // uint256 swapErc20TellerBalanceWithAllPrefills = swapErc20BalanceNoPrefills >=
        //         maxPrefillAmount
        //         ? swapErc20BalanceNoPrefills - maxPrefillAmount
        //         : swapErc20BalanceNoPrefills; // avoid underflow

        // // Assert actual balance is at most expected with no prefills
        // assertLe(tellerBalance, swapErc20BalanceNoPrefills);
        // assertGe(tellerBalance, swapErc20TellerBalanceWithAllPrefills);
    }

    function assert_operation_tellerOwnsAllSwapErc721s() internal {
        uint256[] memory ids = tellerHandler.ghost_swapErc721IdsReceived();
        for (uint256 i = 0; i < ids.length; i++) {
            assertEq(address(teller), swapErc721.ownerOf(ids[i]));
        }
    }

    function assert_operation_totalSwapErc1155ReceivedMatchesTellerBalance()
        internal
    {
        uint256[] memory ids = tellerHandler.ghost_swapErc1155IdsReceived();
        for (uint256 i = 0; i < ids.length; i++) {
            uint256 id = ids[i];
            assertEq(
                swapErc1155.balanceOf(address(teller), id),
                tellerHandler.ghost_totalSwapErc1155ReceivedForId(id)
            );
        }
    }

    function assert_operation_bundlerBalanceMatchesTracked() internal {
        assertEq(
            depositErc20.balanceOf(BUNDLER_ADDRESS),
            tellerHandler.ghost_totalBundlerPayout()
        );
    }
}
