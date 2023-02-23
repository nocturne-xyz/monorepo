//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./ISimpleToken.sol";

contract SimpleERC721Token is ISimpleERC721Token, ERC721, Ownable {
    constructor() ERC721("Simple", "Simple") {}

    function reserveToken(
        address account,
        uint256 tokenId
    ) external virtual override {
        _safeMint(account, tokenId);
    }
}
