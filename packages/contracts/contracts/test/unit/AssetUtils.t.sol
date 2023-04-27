// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "forge-std/Test.sol";

import {AssetUtils} from "../../libs/AssetUtils.sol";
import {SimpleERC1155Token} from "../tokens/SimpleERC1155Token.sol";
import "../../libs/Types.sol";

contract AssetUtilsTest is Test {
    function testEncodeDecodeErc1155() public {
        SimpleERC1155Token erc1155 = new SimpleERC1155Token();
        uint256 id = 115792089237316195423570985008687907853269984665640564039457584007913129639933;

        EncodedAsset memory encodedAsset = AssetUtils.encodeAsset(
            AssetType.ERC1155,
            address(erc1155),
            id
        );

        (
            AssetType decodedAssetType,
            address decodedAssetAddr,
            uint256 decodedId
        ) = AssetUtils.decodeAsset(encodedAsset);

        assertEq(uint256(decodedAssetType), uint256(AssetType.ERC1155));
        assertEq(decodedAssetAddr, address(erc1155));
        assertEq(decodedId, id);
    }
}
