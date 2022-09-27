//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "hardhat/console.sol";

contract SimpleERC721Token is ERC721, Ownable {
    constructor() ERC721("Simple", "Simple") {}

    function reserveToken(address account, uint256 tokenId) external {
        _safeMint(account, tokenId);
    }

    function reserveTokens(address account, uint256[] calldata tokenIds)
        external
    {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            _safeMint(account, tokenIds[i]);
        }
    }

    function transferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public virtual override {
        //solhint-disable-next-line max-line-length
        require(
            _isApprovedOrOwner(_msgSender(), tokenId),
            "ERC721: transfer caller is not owner nor approved"
        );
        _transfer(from, to, tokenId);
    }
}
