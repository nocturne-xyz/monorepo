// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

import {Utils} from "../libs/Utils.sol";
import "../libs/Types.sol";

library AssetUtils {
    function _decodeAsset(
        EncodedAsset memory encodedAsset
    )
        internal
        pure
        returns (AssetType assetType, address assetAddr, uint256 id)
    {
        return
            _decodeAsset(
                encodedAsset.encodedAssetAddr,
                encodedAsset.encodedAssetId
            );
    }

    function _decodeAsset(
        uint256 encodedAssetAddr,
        uint256 encodedAssetId
    )
        internal
        pure
        returns (AssetType assetType, address assetAddr, uint256 id)
    {
        uint256 bitMask_111 = 7;
        uint256 bitMask_11 = 3;
        id = (encodedAssetAddr & (bitMask_111 << 250)) | encodedAssetId;
        assetAddr = address(uint160((encodedAssetAddr << 96) >> 96));
        uint256 asset_type_bits = (encodedAssetAddr >> 160) & bitMask_11;
        if (asset_type_bits == 0) {
            assetType = AssetType.ERC20;
        } else if (asset_type_bits == 1) {
            assetType = AssetType.ERC721;
        } else if (asset_type_bits == 2) {
            assetType = AssetType.ERC1155;
        } else {
            revert("Invalid encodedAssetAddr");
        }
        return (assetType, assetAddr, id);
    }

    function encodeAssetToTuple(
        AssetType assetType,
        address assetAddr,
        uint256 id
    ) internal pure returns (uint256 encodedAssetAddr, uint256 encodedAssetId) {
        encodedAssetId = (id << 3) >> 3;
        uint256 asset_type_bits;
        if (assetType == AssetType.ERC20) {
            asset_type_bits = uint256(0);
        } else if (assetType == AssetType.ERC721) {
            asset_type_bits = uint256(1);
        } else if (assetType == AssetType.ERC1155) {
            asset_type_bits = uint256(2);
        } else {
            revert("Invalid assetType");
        }
        encodedAssetAddr =
            ((id >> 253) << 253) |
            uint256(uint160(assetAddr)) |
            (asset_type_bits << 160);
        return (encodedAssetAddr, encodedAssetId);
    }

    function encodeAsset(
        AssetType assetType,
        address assetAddr,
        uint256 id
    ) internal pure returns (EncodedAsset memory encodedAsset) {
        (uint256 encodedAssetAddr, uint256 encodedAssetId) = encodeAssetToTuple(
            assetType,
            assetAddr,
            id
        );
        return
            EncodedAsset({
                encodedAssetAddr: encodedAssetAddr,
                encodedAssetId: encodedAssetId
            });
    }

    function balanceOfAsset(
        EncodedAsset memory encodedAsset
    ) internal view returns (uint256) {
        (AssetType assetType, address assetAddr, uint256 id) = AssetUtils
            ._decodeAsset(encodedAsset);
        uint256 value;
        if (assetType == AssetType.ERC20) {
            value = IERC20(assetAddr).balanceOf(address(this));
        } else if (assetType == AssetType.ERC721) {
            if (IERC721(assetAddr).ownerOf(id) == address(this)) {
                value = 1;
            }
        } else if (assetType == AssetType.ERC1155) {
            value = IERC1155(assetAddr).balanceOf(address(this), id);
        }
        return value;
    }

    /**
      @dev Transfer asset to receiver. Throws if unsuccssful.
    */
    function transferAssetTo(
        EncodedAsset memory encodedAsset,
        address receiver,
        uint256 value
    ) internal {
        (AssetType assetType, address assetAddr, uint256 id) = _decodeAsset(
            encodedAsset
        );
        if (assetType == AssetType.ERC20) {
            require(
                IERC20(assetAddr).transfer(receiver, value),
                "ERC20 transfer failed"
            );
        } else if (assetType == AssetType.ERC721) {
            // uncaught revert will be propagated
            IERC721(assetAddr).transferFrom(address(this), receiver, id);
        } else if (assetType == AssetType.ERC1155) {
            // uncaught revert will be propagated
            IERC1155(assetAddr).safeTransferFrom(
                address(this),
                receiver,
                id,
                value,
                ""
            );
        } else {
            revert("Invalid asset");
        }
    }

    /**
      @dev Transfer asset from spender. Throws if unsuccssful.
    */
    function transferAssetFrom(
        EncodedAsset memory encodedAsset,
        address spender,
        uint256 value
    ) internal {
        (AssetType assetType, address assetAddr, uint256 id) = _decodeAsset(
            encodedAsset
        );
        if (assetType == AssetType.ERC20) {
            require(
                IERC20(assetAddr).transferFrom(spender, address(this), value),
                "ERC20 transferFrom failed"
            );
        } else if (assetType == AssetType.ERC721) {
            // uncaught revert will be propagated
            IERC721(assetAddr).transferFrom(spender, address(this), id);
        } else if (assetType == AssetType.ERC1155) {
            // uncaught revert will be propagated
            IERC1155(assetAddr).safeTransferFrom(
                spender,
                address(this),
                id,
                value,
                ""
            );
        } else {
            revert("Invalid asset");
        }
    }

    function eq(
        EncodedAsset calldata assetA,
        EncodedAsset calldata assetB
    ) internal pure returns (bool) {
        return
            (assetA.encodedAssetAddr == assetB.encodedAssetAddr) &&
            (assetA.encodedAssetId == assetB.encodedAssetId);
    }
}
