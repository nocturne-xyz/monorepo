// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

import {Utils} from "../libs/Utils.sol";
import "../libs/types.sol";

library AssetUtils {
    function _decodeAsset(
        EncodedAsset memory encodedAsset
    )
        internal
        pure
        returns (AssetType assetType, address assetAddr, uint256 id)
    {
        return _decodeAsset(encodedAsset.encodedAddr, encodedAsset.encodedId);
    }

    function _decodeAsset(
        uint256 encodedAddr,
        uint256 encodedId
    )
        internal
        pure
        returns (AssetType assetType, address assetAddr, uint256 id)
    {
        id = (encodedAddr & (7 << 250)) | encodedId;
        assetAddr = address(uint160((encodedAddr << 96) >> 96));
        uint256 asset_type_bits = (encodedAddr >> 160) & 3;
        require(asset_type_bits <= 3, "Invalid encodedAddr field.");
        if (asset_type_bits == 0) {
            assetType = AssetType.ERC20;
        } else if (asset_type_bits == 1) {
            assetType = AssetType.ERC721;
        } else if (asset_type_bits == 2) {
            assetType = AssetType.ERC1155;
        }
        return (assetType, assetAddr, id);
    }

    function _encodeAssetToTuple(
        AssetType assetType,
        address assetAddr,
        uint256 id
    ) internal pure returns (uint256 encodedAddr, uint256 encodedId) {
        encodedId = (id << 3) >> 3;
        uint256 asset_type_bits;
        if (assetType == AssetType.ERC20) {
            asset_type_bits = uint256(0);
        } else if (assetType == AssetType.ERC721) {
            asset_type_bits = uint256(1);
        } else if (assetType == AssetType.ERC1155) {
            asset_type_bits = uint256(2);
        }
        encodedAddr =
            ((id >> 253) << 253) |
            uint256(uint160(assetAddr)) |
            (asset_type_bits << 160);
        return (encodedAddr, encodedId);
    }

    function _encodeAsset(
        AssetType assetType,
        address assetAddr,
        uint256 id
    ) internal pure returns (EncodedAsset memory encodedAsset) {
        (uint256 encodedAddr, uint256 encodedId) = _encodeAssetToTuple(
            assetType,
            assetAddr,
            id
        );
        return EncodedAsset({encodedAddr: encodedAddr, encodedId: encodedId});
    }

    function _checkEqual(
        EncodedAsset memory assetA,
        EncodedAsset memory assetB
    ) internal pure returns (bool) {
        return (assetA.encodedAddr == assetB.encodedAddr &&
            assetA.encodedId == assetB.encodedId);
    }

    function _transferAssetTo(
        EncodedAsset memory encodedAsset,
        address receiver,
        uint256 value
    ) internal {
        (AssetType assetType, address assetAddr, uint256 id) = _decodeAsset(
            encodedAsset
        );
        if (assetType == AssetType.ERC20) {
            IERC20(assetAddr).transfer(receiver, value);
        } else if (assetType == AssetType.ERC721) {
            IERC721(assetAddr).transferFrom(address(this), receiver, id);
        } else if (assetType == AssetType.ERC1155) {
            IERC1155(assetAddr).safeTransferFrom(
                address(this),
                receiver,
                id,
                value,
                ""
            );
        }
    }

    function _balanceOfAsset(
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

    function _transferAssetFrom(
        EncodedAsset memory encodedAsset,
        address spender,
        uint256 value
    ) internal returns (bool) {
        (AssetType assetType, address assetAddr, uint256 id) = _decodeAsset(
            encodedAsset
        );
        if (assetType == AssetType.ERC20) {
            return
                IERC20(assetAddr).transferFrom(spender, address(this), value);
        } else if (assetType == AssetType.ERC721) {
            try IERC721(assetAddr).transferFrom(spender, address(this), id) {
                return true;
            } catch {
                return false;
            }
        } else if (assetType == AssetType.ERC1155) {
            try
                IERC1155(assetAddr).safeTransferFrom(
                    spender,
                    address(this),
                    id,
                    value,
                    ""
                )
            {
                return true;
            } catch {
                return false;
            }
        }
        return false;
    }
}
