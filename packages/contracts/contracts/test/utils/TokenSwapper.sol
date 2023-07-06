// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {Teller} from "../../Teller.sol";
import "./NocturneUtils.sol";
import "../../libs/Types.sol";
import "../tokens/ISimpleToken.sol";

struct SwapRequest {
    address assetInOwner;
    EncodedAsset encodedAssetIn;
    uint256 assetInAmount;
    address erc20Out;
    uint256 erc20OutAmount;
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
    }
}
