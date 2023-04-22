// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

import {Utils} from "../libs/Utils.sol";
import "../libs/Types.sol";

library AssetUtils {
    using SafeERC20 for IERC20;

    uint256 constant MASK_111 = 7;
    uint256 constant MASK_11 = 3;
    uint256 constant MIDDLE_250_TO_252_MASK = (MASK_111 << 250);
    uint256 constant TOP_THREE_MASK = (MASK_111 << 253);
    uint256 constant BOTTOM_253_MASK = (1 << 253) - 1;
    uint256 constant BOTTOM_160_MASK = (1 << 160) - 1;

    function encodeAsset(
        AssetType assetType,
        address assetAddr,
        uint256 id
    ) internal pure returns (EncodedAsset memory encodedAsset) {
        uint256 encodedAssetId = id & ((1 << 253) - 1);
        uint256 assetTypeBits;
        if (assetType == AssetType.ERC20) {
            assetTypeBits = uint256(0);
        } else if (assetType == AssetType.ERC721) {
            assetTypeBits = uint256(1);
        } else if (assetType == AssetType.ERC1155) {
            assetTypeBits = uint256(2);
        } else {
            revert("Invalid assetType");
        }

        uint256 encodedAssetAddr = ((id >> 3) & MIDDLE_250_TO_252_MASK) |
            (assetTypeBits << 160) |
            (uint256(uint160(assetAddr)));

        return
            EncodedAsset({
                encodedAssetAddr: encodedAssetAddr,
                encodedAssetId: encodedAssetId
            });
    }

    function decodeAsset(
        EncodedAsset memory encodedAsset
    )
        internal
        pure
        returns (AssetType assetType, address assetAddr, uint256 id)
    {
        id =
            ((encodedAsset.encodedAssetAddr & MIDDLE_250_TO_252_MASK) << 3) |
            encodedAsset.encodedAssetId;
        assetAddr = address(
            uint160(encodedAsset.encodedAssetAddr & BOTTOM_160_MASK)
        );
        uint256 assetTypeBits = (encodedAsset.encodedAssetAddr >> 160) &
            MASK_11;
        if (assetTypeBits == 0) {
            assetType = AssetType.ERC20;
        } else if (assetTypeBits == 1) {
            assetType = AssetType.ERC721;
        } else if (assetTypeBits == 2) {
            assetType = AssetType.ERC1155;
        } else {
            revert("Invalid encodedAssetAddr");
        }
        return (assetType, assetAddr, id);
    }

    function hashEncodedAsset(
        EncodedAsset memory encodedAsset
    ) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    encodedAsset.encodedAssetAddr,
                    encodedAsset.encodedAssetId
                )
            );
    }

    function balanceOfAsset(
        EncodedAsset memory encodedAsset
    ) internal view returns (uint256) {
        (AssetType assetType, address assetAddr, uint256 id) = AssetUtils
            .decodeAsset(encodedAsset);
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
        (AssetType assetType, address assetAddr, uint256 id) = decodeAsset(
            encodedAsset
        );
        if (assetType == AssetType.ERC20) {
            IERC20(assetAddr).safeTransfer(receiver, value);
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
        (AssetType assetType, address assetAddr, uint256 id) = decodeAsset(
            encodedAsset
        );
        if (assetType == AssetType.ERC20) {
            IERC20(assetAddr).safeTransferFrom(spender, address(this), value);
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

    /**
      @dev Approve asset to spender for amount. Throws if unsuccssful.
    */
    function approveAsset(
        EncodedAsset memory encodedAsset,
        address spender,
        uint256 amount
    ) internal {
        (AssetType assetType, address assetAddr, uint256 id) = decodeAsset(
            encodedAsset
        );

        if (assetType == AssetType.ERC20) {
            // TODO: next OZ release will add SafeERC20.forceApprove
            IERC20(assetAddr).approve(spender, 0);
            IERC20(assetAddr).approve(spender, amount);
        } else if (assetType == AssetType.ERC721) {
            // uncaught revert will be propagated
            IERC721(assetAddr).approve(spender, id);
        } else if (assetType == AssetType.ERC1155) {
            // uncaught revert will be propagated
            IERC1155(assetAddr).setApprovalForAll(spender, true);
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
