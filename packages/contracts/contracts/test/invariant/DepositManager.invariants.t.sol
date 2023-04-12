// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {Test} from "forge-std/Test.sol";
import {console} from "forge-std/console.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";

import {DepositManagerHandler} from "./actors/DepositManagerHandler.sol";

contract DepositManagerInvariants is Test {
    DepositManagerHandler public depositManagerHandler;

    function setUp() public virtual {
        depositManagerHandler = new DepositManagerHandler();

        bytes4[] memory selectors = new bytes4[](4);
        selectors[0] = depositManagerHandler.instantiateDepositETH.selector;
        selectors[1] = depositManagerHandler.instantiateDepositErc20.selector;
        selectors[2] = depositManagerHandler.retrieveDepositErc20.selector;
        selectors[3] = depositManagerHandler.completeDepositErc20.selector;

        targetContract(address(depositManagerHandler));
        targetSelector(
            FuzzSelector({
                addr: address(depositManagerHandler),
                selectors: selectors
            })
        );

        excludeSender(address(depositManagerHandler));
        excludeSender(address(depositManagerHandler.wallet()));
        excludeSender(address(depositManagerHandler.depositManager()));
        excludeSender(address(depositManagerHandler.weth()));
    }

    function invariant_callSummary() public view {
        depositManagerHandler.callSummary();
    }

    // _______________ETH_______________

    function invariant_outNeverExceedsInETH() external {
        assertGe(
            depositManagerHandler.ghost_instantiateDepositSumETH(),
            depositManagerHandler.ghost_retrieveDepositSumETH() +
                depositManagerHandler.ghost_completeDepositSumETH()
        );
    }

    function invariant_depositManagerBalanceEqualsInMinusOutETH() external {
        assertEq(
            depositManagerHandler.weth().balanceOf(
                address(depositManagerHandler.depositManager())
            ),
            depositManagerHandler.ghost_instantiateDepositSumETH() -
                depositManagerHandler.ghost_retrieveDepositSumETH() -
                depositManagerHandler.ghost_completeDepositSumETH()
        );
    }

    function invariant_allActorsBalanceSumETHEqualsRetrieveDepositSumETH()
        external
    {
        address[] memory allActors = depositManagerHandler.ghost_AllActors();

        uint256 sum = 0;
        for (uint256 i = 0; i < allActors.length; i++) {
            sum += depositManagerHandler.weth().balanceOf(allActors[i]);
        }

        assertEq(sum, depositManagerHandler.ghost_retrieveDepositSumETH());
    }

    function invariant_walletBalanceEqualsCompletedDepositSumETH() external {
        assertEq(
            depositManagerHandler.weth().balanceOf(
                address(depositManagerHandler.wallet())
            ),
            depositManagerHandler.ghost_completeDepositSumETH()
        );
    }

    function invariant_actorBalanceAlwaysEqualsRetrievedETH() external {
        address[] memory allActors = depositManagerHandler.ghost_AllActors();

        for (uint256 i = 0; i < allActors.length; i++) {
            assertEq(
                depositManagerHandler.weth().balanceOf(allActors[i]),
                depositManagerHandler.ghost_retrieveDepositSumETHFor(
                    allActors[i]
                )
            );
        }
    }

    function invariant_actorBalanceNeverExceedsInstantiatedETH() external {
        address[] memory allActors = depositManagerHandler.ghost_AllActors();

        for (uint256 i = 0; i < allActors.length; i++) {
            assertLe(
                depositManagerHandler.weth().balanceOf(allActors[i]),
                depositManagerHandler.ghost_instantiateDepositSumETHFor(
                    allActors[i]
                )
            );
        }
    }

    // _______________ERC20_______________

    function invariant_outNeverExceedsInErc20() external {
        assertGe(
            depositManagerHandler.ghost_instantiateDepositSumErc20(),
            depositManagerHandler.ghost_retrieveDepositSumErc20() +
                depositManagerHandler.ghost_completeDepositSumErc20()
        );
    }

    function invariant_depositManagerBalanceEqualsInMinusOutErc20() external {
        assertEq(
            depositManagerHandler.erc20().balanceOf(
                address(depositManagerHandler.depositManager())
            ),
            depositManagerHandler.ghost_instantiateDepositSumErc20() -
                depositManagerHandler.ghost_retrieveDepositSumErc20() -
                depositManagerHandler.ghost_completeDepositSumErc20()
        );
    }

    function invariant_allActorsBalanceSumErc20EqualsRetrieveDepositSumErc20()
        external
    {
        address[] memory allActors = depositManagerHandler.ghost_AllActors();

        uint256 sum = 0;
        for (uint256 i = 0; i < allActors.length; i++) {
            sum += depositManagerHandler.erc20().balanceOf(allActors[i]);
        }

        assertEq(sum, depositManagerHandler.ghost_retrieveDepositSumErc20());
    }

    function invariant_walletBalanceEqualsCompletedDepositSumErc20() external {
        assertEq(
            depositManagerHandler.erc20().balanceOf(
                address(depositManagerHandler.wallet())
            ),
            depositManagerHandler.ghost_completeDepositSumErc20()
        );
    }

    function invariant_actorBalanceAlwaysEqualsRetrievedErc20() external {
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

    function invariant_actorBalanceNeverExceedsInstantiatedErc20() external {
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
}
