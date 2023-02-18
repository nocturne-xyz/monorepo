//SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.17;

import "../../libs/Types.sol";
import {BalanceManager} from "../../BalanceManager.sol";

contract TestBalanceManager is BalanceManager {
    function initialize(
        address vault,
        address joinSplitVerifier,
        address subtreeUpdateVerifier
    ) external initializer {
        __BalanceManager__init(vault, joinSplitVerifier, subtreeUpdateVerifier);
    }

    function makeDeposit(Deposit calldata deposit) public {
        _makeDeposit(deposit);
    }
}
