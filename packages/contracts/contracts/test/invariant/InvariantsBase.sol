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

    address[] public depositErc20s;

    // WETH9 public weth;
    // SimpleERC20Token public depositErc20;
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

    function assert_protocol_tellerNonWethErc20BalancesConsistent() internal {
        for (uint256 i = 1; i < depositErc20s.length; i++) {
            uint256 tellerBalance = IERC20(depositErc20s[i]).balanceOf(
                address(teller)
            );

            // Since taking prefills inflates ghost_totalTransferredOutOfTeller,
            // we need to add the number of times prefills are taken to make up for over subtraction
            uint256 expectedInTeller = depositManagerHandler
                .ghost_completeDepositSumErc20ForToken(i) +
                tellerHandler.ghost_numberOfTimesPrefillTakenForToken(i) -
                tellerHandler.ghost_totalTransferredOutOfTellerForToken(i) -
                tellerHandler.ghost_numberOfTimesPrefillRefilledForToken(i);

            assertEq(tellerBalance, expectedInTeller);
        }
    }

    function assert_protocol_tellerWethBalanceConsistent() internal {
        uint256 tellerBalance = IERC20(depositErc20s[0]).balanceOf(
            address(teller)
        );

        // Since taking prefills inflates ghost_totalTransferredOutOfTeller,
        // we need to add the number of times prefills are taken to make up for over subtraction
        uint256 expectedInTeller = depositManagerHandler
            .ghost_completeDepositSumErc20ForToken(0) +
            tellerHandler.ghost_numberOfTimesPrefillTakenForToken(0) -
            tellerHandler.ghost_totalTransferredOutOfTellerForToken(0) -
            tellerHandler.ghost_numberOfTimesPrefillRefilledForToken(0) -
            tellerHandler.ghost_totalBundlerPayout();

        assertEq(tellerBalance, expectedInTeller);
    }

    function assert_protocol_handlerErc20BalancesAlwaysZeroOrOne() internal {
        for (uint256 i = 0; i < depositErc20s.length; i++) {
            uint256 handlerBalance = IERC20(depositErc20s[i]).balanceOf(
                address(handler)
            );
            assertGe(handlerBalance, 0);
            assertLe(handlerBalance, 1);
        }

        assertGe(swapErc20.balanceOf(address(handler)), 0);
        assertLe(swapErc20.balanceOf(address(handler)), 1);
    }

    function assert_deposit_outNeverExceedsInErc20s() internal {
        for (uint256 i = 0; i < depositErc20s.length; i++) {
            assertGe(
                depositManagerHandler.ghost_instantiateDepositSumErc20ForToken(
                    i
                ),
                depositManagerHandler.ghost_retrieveDepositSumErc20ForToken(i) +
                    depositManagerHandler.ghost_completeDepositSumErc20ForToken(
                        i
                    )
            );
        }
    }

    function assert_deposit_depositManagerBalanceEqualsInMinusOutErc20s()
        internal
    {
        for (uint256 i = 0; i < depositErc20s.length; i++) {
            assertEq(
                IERC20(depositErc20s[i]).balanceOf(
                    address(depositManagerHandler.depositManager())
                ),
                depositManagerHandler.ghost_instantiateDepositSumErc20ForToken(
                    i
                ) -
                    depositManagerHandler.ghost_retrieveDepositSumErc20ForToken(
                        i
                    ) -
                    depositManagerHandler.ghost_completeDepositSumErc20ForToken(
                        i
                    )
            );
        }
    }

    function assert_deposit_allActorsBalanceSumEqualsRetrieveDepositSumErc20s()
        internal
    {
        for (uint256 i = 0; i < depositErc20s.length; i++) {
            address[] memory allActors = depositManagerHandler
                .ghost_AllActors();

            uint256 sum = 0;
            for (uint256 j = 0; j < allActors.length; j++) {
                sum += IERC20(depositErc20s[i]).balanceOf(allActors[j]);
            }

            assertEq(
                sum,
                depositManagerHandler.ghost_retrieveDepositSumErc20ForToken(i)
            );
        }
    }

    function assert_deposit_actorBalanceAlwaysEqualsRetrievedErc20s() internal {
        for (uint256 i = 0; i < depositErc20s.length; i++) {
            address[] memory allActors = depositManagerHandler
                .ghost_AllActors();

            for (uint256 j = 0; j < allActors.length; j++) {
                assertEq(
                    IERC20(depositErc20s[i]).balanceOf(allActors[j]),
                    depositManagerHandler
                        .ghost_retrieveDepositSumErc20ForActorOfToken(
                            allActors[j],
                            i
                        )
                );
            }
        }
    }

    function assert_deposit_actorBalanceNeverExceedsInstantiatedErc20s()
        internal
    {
        for (uint256 i = 0; i < depositErc20s.length; i++) {
            address[] memory allActors = depositManagerHandler
                .ghost_AllActors();

            for (uint256 j = 0; j < allActors.length; j++) {
                assertLe(
                    IERC20(depositErc20s[i]).balanceOf(allActors[j]),
                    depositManagerHandler
                        .ghost_instantiateDepositSumErc20ForActorOfToken(
                            allActors[j],
                            i
                        )
                );
            }
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
            console.logUint(actorBalance);
            uint256 actorBalanceCap = depositManagerHandler
                .ghost_totalSuppliedGasCompensationForActor(allActors[i]);

            assertLe(actorBalance, actorBalanceCap);
        }
    }

    // _______________OPERATIONS_______________

    function assert_operation_totalSwapErc20ReceivedMatchesTellerBalance()
        internal
    {
        uint256 swapErc20Balance = swapErc20.balanceOf(address(teller));
        uint256 expectedSwapErc20Balance = tellerHandler
            .ghost_totalSwapErc20Received();
        assertEq(swapErc20Balance, expectedSwapErc20Balance);
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
            IERC20(depositErc20s[0]).balanceOf(BUNDLER_ADDRESS),
            tellerHandler.ghost_totalBundlerPayout()
        );
    }

    function assert_operation_joinSplitTokensTransferredOutNeverExceedsUnwrappedByMoreThanNumberOfTimesPrefillTaken()
        internal
    {
        uint256 numJoinSplitTokens = tellerHandler.numJoinSplitTokens();
        for (uint256 i = 0; i < numJoinSplitTokens; i++) {
            assertLe(
                tellerHandler.ghost_totalTransferredOutOfTellerForToken(1),
                tellerHandler.ghost_totalJoinSplitUnwrappedForToken(1) +
                    tellerHandler.ghost_numberOfTimesPrefillTakenForToken(1)
            );
        }
    }
}
