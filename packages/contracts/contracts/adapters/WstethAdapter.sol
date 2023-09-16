// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.17;

import {IWeth} from "../interfaces/IWeth.sol";
import {IWsteth} from "../interfaces/IWsteth.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";

/// @title WstethAdapter
/// @author Nocturne Labs
/// @notice Adapter contract for interacting with wsteth. The Handler contract does not support ETH
///         value transfers directly, thus we need a thin adapter for handling the weth -> eth step
///         when converting weth to wsteth.
contract WstethAdapter {
    // Weth contract
    IWeth public _weth;

    // Wsteth contract
    IWsteth public _wsteth;

    // Constructor, takes weth and wsteth
    constructor(address weth, address wsteth) {
        _weth = IWeth(weth);
        _wsteth = IWsteth(wsteth);
    }

    // Receive eth when withdrawing weth to eth
    receive() external payable {}

    // TODO: add weth and wsteth prefill function

    /// @notice Convert weth to wsteth for caller
    /// @param amount Amount of weth to convert
    /// @dev Transfers weth to self, unwraps to eth, converts to wsteth, then transfers wsteth back
    ///      to caller
    function convert(uint256 amount) external {
        _weth.transferFrom(msg.sender, address(this), amount);
        _weth.withdraw(amount);
        Address.sendValue(payable(address(_wsteth)), amount);
        _wsteth.transfer(msg.sender, _wsteth.balanceOf(address(this)));
    }
}
