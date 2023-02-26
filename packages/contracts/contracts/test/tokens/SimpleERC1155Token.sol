//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./ISimpleToken.sol";

contract SimpleERC1155Token is ISimpleERC1155Token, ERC1155, Ownable {
    constructor() ERC1155("Simple") {}

    function reserveTokens(
        address account,
        uint256 id,
        uint256 amount
    ) external virtual override {
        _mint(account, id, amount, "");
    }
}
