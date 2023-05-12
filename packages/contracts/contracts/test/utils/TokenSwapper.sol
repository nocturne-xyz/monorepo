// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {Teller} from "../../Teller.sol";
import "./NocturneUtils.sol";
import "../../libs/Types.sol";
import "../tokens/ISimpleToken.sol";

import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";

struct SwapRequest {
    address assetInOwner;
    EncodedAsset encodedAssetIn;
    uint256 assetInAmount;
    address erc20Out;
    uint256 erc20OutAmount;
    address erc721Out;
    uint256 erc721OutId;
    address erc1155Out;
    uint256 erc1155OutId;
    uint256 erc1155OutAmount;
}

contract TokenSwapper is IERC721Receiver, IERC1155Receiver {
    function swap(SwapRequest memory request) public {
        AssetUtils.transferAssetFrom(
            request.encodedAssetIn,
            request.assetInOwner,
            request.assetInAmount
        );

        if (address(request.erc20Out) != address(0x0)) {
            ISimpleERC20Token(request.erc20Out).reserveTokens(
                address(this),
                request.erc20OutAmount
            );
            ISimpleERC20Token(request.erc20Out).transfer(
                msg.sender,
                request.erc20OutAmount
            );
        }
        // if (address(request.erc721Out) != address(0x0)) {
        //     ISimpleERC721Token(request.erc721Out).reserveToken(
        //         address(this),
        //         request.erc721OutId
        //     );
        //     ISimpleERC721Token(request.erc721Out).safeTransferFrom(
        //         address(this),
        //         msg.sender,
        //         request.erc721OutId
        //     );
        // }
        if (address(request.erc1155Out) != address(0x0)) {
            ISimpleERC1155Token(request.erc1155Out).reserveTokens(
                address(this),
                request.erc1155OutId,
                request.erc1155OutAmount
            );
            ISimpleERC1155Token(request.erc1155Out).safeTransferFrom(
                address(this),
                msg.sender,
                request.erc1155OutId,
                request.erc1155OutAmount,
                ""
            );
        }
    }

    function supportsInterface(
        bytes4 interfaceId
    ) external pure override returns (bool) {
        return
            (interfaceId == type(IERC721Receiver).interfaceId) ||
            (interfaceId == type(IERC1155Receiver).interfaceId);
    }

    function onERC721Received(
        address, // operator
        address, // from
        uint256, // id
        bytes calldata // data
    ) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    function onERC1155Received(
        address, // operator
        address, // from
        uint256, // id
        uint256, // value
        bytes calldata // data
    ) external pure override returns (bytes4) {
        return IERC1155Receiver.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address, // operator
        address, // from
        uint256[] calldata, // ids
        uint256[] calldata, // values
        bytes calldata // data
    ) external pure override returns (bytes4) {
        return IERC1155Receiver.onERC1155BatchReceived.selector;
    }
}
