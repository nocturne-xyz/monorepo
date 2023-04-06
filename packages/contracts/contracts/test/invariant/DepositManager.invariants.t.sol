// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {Test} from "forge-std/Test.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";

import {InvariantHandler} from "./handlers/InvariantHandler.sol";

contract DepositManagerInvariants is Test {
    InvariantHandler public invariantHandler;

    function setUp() public virtual {
        invariantHandler = new InvariantHandler();

        bytes4[] memory selectors = new bytes4[](1);
        selectors[0] = InvariantHandler.instantiateDepositErc20.selector;

        targetContract(address(invariantHandler));
        targetSelector(
            FuzzSelector({
                addr: address(invariantHandler),
                selectors: selectors
            })
        );
    }

    // Total balance of deposit manager equals total deposits instantiated
    // amount - total retrieval amount - total deposits completed amount
    function invariant_conservationOfErc20() external {
        // TODO: subtract retrievals and completions
        assertEq(
            invariantHandler.erc20().balanceOf(
                address(invariantHandler.depositManager())
            ),
            invariantHandler.ghost_instantiateDepositSum()
        );
    }
}
