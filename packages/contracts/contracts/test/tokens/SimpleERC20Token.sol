//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./ISimpleToken.sol";

contract SimpleERC20Token is ISimpleERC20Token, ERC20, Ownable {
    constructor() ERC20("Simple", "Simple") {}

    function reserveTokens(
        address account,
        uint256 amount
    ) external virtual override {
        _mint(account, amount);
    }
}
