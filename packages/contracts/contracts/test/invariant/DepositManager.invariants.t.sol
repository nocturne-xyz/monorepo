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

        bytes4[] memory selectors = new bytes4[](4);
        selectors[0] = InvariantHandler.instantiateDepositETH.selector;
        selectors[1] = InvariantHandler.instantiateDepositErc20.selector;
        selectors[2] = InvariantHandler.retrieveDepositErc20.selector;
        selectors[3] = InvariantHandler.completeDepositErc20.selector;

        targetContract(address(invariantHandler));
        targetSelector(
            FuzzSelector({
                addr: address(invariantHandler),
                selectors: selectors
            })
        );

        excludeSender(address(invariantHandler));
        excludeSender(address(invariantHandler.wallet()));
        excludeSender(address(invariantHandler.depositManager()));
        excludeSender(address(invariantHandler.weth()));
    }

    function invariant_callSummary() public view {
        invariantHandler.callSummary();
    }

    // _______________ETH_______________

    function invariant_outNeverExceedsInETH() external {
        assertGe(
            invariantHandler.ghost_instantiateDepositSumETH(),
            invariantHandler.ghost_retrieveDepositSumETH() +
                invariantHandler.ghost_completeDepositSumETH()
        );
    }

    function invariant_depositManagerBalanceEqualsInMinusOutETH() external {
        assertEq(
            invariantHandler.weth().balanceOf(
                address(invariantHandler.depositManager())
            ),
            invariantHandler.ghost_instantiateDepositSumETH() -
                invariantHandler.ghost_retrieveDepositSumETH() -
                invariantHandler.ghost_completeDepositSumETH()
        );
    }

    function invariant_allActorsBalanceSumETHEqualsRetrieveDepositSumETH()
        external
    {
        address[] memory allActors = invariantHandler.ghost_AllActors();

        uint256 sum = 0;
        for (uint256 i = 0; i < allActors.length; i++) {
            sum += invariantHandler.weth().balanceOf(allActors[i]);
        }

        assertEq(sum, invariantHandler.ghost_retrieveDepositSumETH());
    }

    function invariant_walletBalanceEqualsCompletedDepositSumETH() external {
        assertEq(
            invariantHandler.weth().balanceOf(
                address(invariantHandler.wallet())
            ),
            invariantHandler.ghost_completeDepositSumETH()
        );
    }

    function invariant_actorBalanceAlwaysEqualsRetrievedETH() external {
        address[] memory allActors = invariantHandler.ghost_AllActors();

        for (uint256 i = 0; i < allActors.length; i++) {
            assertEq(
                invariantHandler.weth().balanceOf(allActors[i]),
                invariantHandler.ghost_retrieveDepositSumETHFor(allActors[i])
            );
        }
    }

    function invariant_actorBalanceNeverExceedsInstantiatedETH() external {
        address[] memory allActors = invariantHandler.ghost_AllActors();

        for (uint256 i = 0; i < allActors.length; i++) {
            assertLe(
                invariantHandler.weth().balanceOf(allActors[i]),
                invariantHandler.ghost_instantiateDepositSumETHFor(allActors[i])
            );
        }
    }

    // _______________ERC20_______________

    function invariant_outNeverExceedsInErc20() external {
        assertGe(
            invariantHandler.ghost_instantiateDepositSumErc20(),
            invariantHandler.ghost_retrieveDepositSumErc20() +
                invariantHandler.ghost_completeDepositSumErc20()
        );
    }

    function invariant_depositManagerBalanceEqualsInMinusOutErc20() external {
        assertEq(
            invariantHandler.erc20().balanceOf(
                address(invariantHandler.depositManager())
            ),
            invariantHandler.ghost_instantiateDepositSumErc20() -
                invariantHandler.ghost_retrieveDepositSumErc20() -
                invariantHandler.ghost_completeDepositSumErc20()
        );
    }

    function invariant_allActorsBalanceSumErc20EqualsRetrieveDepositSumErc20()
        external
    {
        address[] memory allActors = invariantHandler.ghost_AllActors();

        uint256 sum = 0;
        for (uint256 i = 0; i < allActors.length; i++) {
            sum += invariantHandler.erc20().balanceOf(allActors[i]);
        }

        assertEq(sum, invariantHandler.ghost_retrieveDepositSumErc20());
    }

    function invariant_walletBalanceEqualsCompletedDepositSumErc20() external {
        assertEq(
            invariantHandler.erc20().balanceOf(
                address(invariantHandler.wallet())
            ),
            invariantHandler.ghost_completeDepositSumErc20()
        );
    }

    function invariant_actorBalanceAlwaysEqualsRetrievedErc20() external {
        address[] memory allActors = invariantHandler.ghost_AllActors();

        for (uint256 i = 0; i < allActors.length; i++) {
            assertEq(
                invariantHandler.erc20().balanceOf(allActors[i]),
                invariantHandler.ghost_retrieveDepositSumErc20For(allActors[i])
            );
        }
    }

    function invariant_actorBalanceNeverExceedsInstantiatedErc20() external {
        address[] memory allActors = invariantHandler.ghost_AllActors();

        for (uint256 i = 0; i < allActors.length; i++) {
            assertLe(
                invariantHandler.erc20().balanceOf(allActors[i]),
                invariantHandler.ghost_instantiateDepositSumErc20For(
                    allActors[i]
                )
            );
        }
    }
}
