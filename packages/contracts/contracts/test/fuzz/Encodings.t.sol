//SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.17;

import "forge-std/Test.sol";
import {AssetUtils} from "../../libs/AssetUtils.sol";
import "../../libs/Types.sol";

contract EncodingsTest is Test {
    function testFuzz_EncodeDecodeAsset(
        uint256 assetTypeUnbounded,
        address asset,
        uint256 id
    ) public {
        uint256 assetType = bound(assetTypeUnbounded, 0, 2);

        EncodedAsset memory encodedAsset = AssetUtils.encodeAsset(
            AssetType(assetType),
            asset,
            id
        );

        (
            AssetType decodedAssetType,
            address decodedAssetAddr,
            uint256 decodedId
        ) = AssetUtils.decodeAsset(encodedAsset);

        assertEq(uint256(decodedAssetType), uint256(assetType));
        assertEq(decodedAssetAddr, address(asset));
        assertEq(decodedId, id);
    }
}
