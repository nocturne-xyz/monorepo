// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {Wallet} from "../../Wallet.sol";
import "./NocturneUtils.sol";
import "../../libs/Types.sol";
import "../tokens/SimpleERC20Token.sol";
import "../tokens/SimpleERC721Token.sol";
import "../tokens/SimpleERC1155Token.sol";

struct SwapRequest {
    address assetInOwner;
    EncodedAsset encodedAssetIn;
    uint256 amountIn;
    SimpleERC20Token erc20Out;
    uint256 erc20OutAmount;
    SimpleERC721Token erc721Out;
    uint256 erc721OutId;
    SimpleERC1155Token erc1155Out;
    uint256 erc1155OutId;
    uint256 erc1155OutAmount;
}

contract TokenSwapper {
    SimpleERC20Token _erc20;
    SimpleERC721Token _erc721;
    SimpleERC1155Token _erc1155;

    constructor(
        SimpleERC20Token erc20,
        SimpleERC721Token erc721,
        SimpleERC1155Token erc1155
    ) {
        _erc20 = erc20;
        _erc721 = erc721;
        _erc1155 = erc1155;
    }

    function swap(SwapRequest memory request) public {
        AssetUtils.transferAssetFrom(
            request.encodedAssetIn,
            request.assetInOwner,
            request.amountIn
        );

        if (address(request.erc20Out) != address(0x0)) {
            request.erc20Out.reserveTokens(
                address(this),
                request.erc20OutAmount
            );
            request.erc20Out.transfer(msg.sender, request.erc20OutAmount);
        }
        if (address(request.erc721Out) != address(0x0)) {
            request.erc721Out.reserveToken(address(this), request.erc721OutId);
            request.erc721Out.safeTransferFrom(
                address(this),
                msg.sender,
                request.erc721OutId
            );
        }
        if (address(request.erc1155Out) != address(0x0)) {
            request.erc1155Out.reserveTokens(
                address(this),
                request.erc1155OutId,
                request.erc1155OutAmount
            );
            request.erc1155Out.safeTransferFrom(
                address(this),
                msg.sender,
                request.erc1155OutId,
                request.erc1155OutAmount,
                ""
            );
        }
    }
}
