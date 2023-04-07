// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {Test} from "forge-std/Test.sol";
import {console} from "forge-std/console.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";

import {InvariantHandler} from "./handlers/InvariantHandler.sol";

contract DepositManagerInvariants is Test {
    InvariantHandler public invariantHandler;

    function setUp() public virtual {
        invariantHandler = new InvariantHandler();

        bytes4[] memory selectors = new bytes4[](3);
        selectors[0] = InvariantHandler.instantiateDepositErc20.selector;
        selectors[1] = InvariantHandler.retrieveDepositErc20.selector;
        selectors[2] = InvariantHandler.completeDepositErc20.selector;

        targetContract(address(invariantHandler));
        targetSelector(
            FuzzSelector({
                addr: address(invariantHandler),
                selectors: selectors
            })
        );
    }

    function invariant_callSummary() public view {
        invariantHandler.callSummary();
    }

    function invariant_outNeverExceedsIn() external {
        assertGe(
            invariantHandler.ghost_instantiateDepositSum(),
            invariantHandler.ghost_retrieveDepositSum() +
                invariantHandler.ghost_completeDepositSum()
        );
    }

    function invariant_depositManagerBalanceEqualsInMinusOut() external {
        assertEq(
            invariantHandler.erc20().balanceOf(
                address(invariantHandler.depositManager())
            ),
            invariantHandler.ghost_instantiateDepositSum() -
                invariantHandler.ghost_retrieveDepositSum() -
                invariantHandler.ghost_completeDepositSum()
        );
    }

    function invariant_allActorsBalanceSumEqualsRetrieveDepositSum() external {
        address[] memory allActors = invariantHandler.ghost_AllActors();

        uint256 sum = 0;
        for (uint256 i = 0; i < allActors.length; i++) {
            sum += invariantHandler.erc20().balanceOf(allActors[i]);
        }

        assertEq(sum, invariantHandler.ghost_retrieveDepositSum());
    }

    function invariant_walletBalanceEqualsCompletedDepositSum() external {
        assertEq(
            invariantHandler.erc20().balanceOf(
                address(invariantHandler.wallet())
            ),
            invariantHandler.ghost_completeDepositSum()
        );
    }

    function invariant_actorBalanceAlwaysEqualsRetrieved() external {
        address[] memory allActors = invariantHandler.ghost_AllActors();

        for (uint256 i = 0; i < allActors.length; i++) {
            assertEq(
                invariantHandler.erc20().balanceOf(allActors[i]),
                invariantHandler.ghost_retrieveDepositSumFor(allActors[i])
            );
        }
    }

    function invariant_actorBalanceNeverExceedsInstantiated() external {
        address[] memory allActors = invariantHandler.ghost_AllActors();

        for (uint256 i = 0; i < allActors.length; i++) {
            assertLe(
                invariantHandler.erc20().balanceOf(allActors[i]),
                invariantHandler.ghost_instantiateDepositSumFor(allActors[i])
            );
        }
    }
}
