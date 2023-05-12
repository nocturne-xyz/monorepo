//SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.17;

import "../../libs/Types.sol";
import {Handler} from "../../Handler.sol";

contract TestHandler is Handler {
    function receivedAssetsLength() public view returns (uint256) {
        return _receivedAssets.length;
    }

    function getReceivedAssetsByIndex(
        uint256 index
    ) public view returns (EncodedAsset memory) {
        return _receivedAssets[index];
    }
}
