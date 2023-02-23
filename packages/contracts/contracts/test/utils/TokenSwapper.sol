// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {Wallet} from "../../Wallet.sol";
import "./NocturneUtils.sol";
import "../../libs/Types.sol";
import "../tokens/ISimpleToken.sol";

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

contract TokenSwapper {
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
        if (address(request.erc721Out) != address(0x0)) {
            ISimpleERC721Token(request.erc721Out).reserveToken(
                address(this),
                request.erc721OutId
            );
            ISimpleERC721Token(request.erc721Out).safeTransferFrom(
                address(this),
                msg.sender,
                request.erc721OutId
            );
        }
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
}
