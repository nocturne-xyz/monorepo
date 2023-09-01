// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.17;

// External
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
// Internal
import {IWeth} from "./interfaces/IWeth.sol";
import {IWsteth} from "./interfaces/IWsteth.sol";
import "./libs/Types.sol";

contract EthAdapter {
    // Weth contract
    IWeth public _weth;

    // Constructor, takes weth
    constructor(address weth) {
        _weth = IWeth(weth);
    }

    receive() external payable {}

    /// @notice Perform an action with eth value unwrapped from weth
    /// @param value Amount of weth to convert
    /// @param action Action to perform
    /// @param outputTokens Tokens to return to caller
    /// @dev Transfers weth to self, unwraps to eth, executes action, then transfers specified
    ///      tokens back to caller.
    function withEthValue(
        uint256 value,
        Action calldata action,
        address[] calldata outputTokens
    ) external returns (bool success, bytes memory result) {
        // Unwrap weth to eth
        _weth.transferFrom(msg.sender, address(this), value);
        _weth.withdraw(value);

        // Execute action
        (success, result) = action.contractAddress.call{value: value}(
            action.encodedFunction
        );

        // Return specified tokens to caller
        for (uint256 i = 0; i < outputTokens.length; i++) {
            IERC20 token = IERC20(outputTokens[i]);
            token.transfer(msg.sender, token.balanceOf(address(this)));
        }
    }
}
