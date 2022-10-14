//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract SimpleERC20Token is ERC20, Ownable {
    constructor() ERC20("Simple", "Simple") {}

    function reserveTokens(address account, uint256 amount) external onlyOwner {
        _mint(account, amount);
    }
}
