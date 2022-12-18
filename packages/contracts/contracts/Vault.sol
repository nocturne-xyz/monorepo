//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.17;
pragma abicoder v2;

import {IVault} from "./interfaces/IVault.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";

import {Utils} from "./libs/Utils.sol";
import "./libs/types.sol";

import "hardhat/console.sol";

contract Vault is IVault, IERC721Receiver, IERC1155Receiver {
    address public _wallet;

    modifier onlyWallet() {
        require(msg.sender == _wallet, "Not called from Teller");
        _;
    }

    // TODO: deployment can be front run
    function initialize(address wallet) external {
        require(_wallet == address(0), "Vault already initialized");
        _wallet = wallet;
    }

    function requestAsset(
        EncodedAsset calldata encodedAsset,
        uint256 value
    ) external override onlyWallet {
        (AssetType assetType, address assetAddr, uint256 id) = Utils
            ._decodeAsset(encodedAsset);
        if (assetType == AssetType.ERC20) {
            require(
                IERC20(assetAddr).transfer(_wallet, value),
                "Transfer failed"
            );
        } else if (assetType == AssetType.ERC721) {
            IERC721(assetAddr).safeTransferFrom(address(this), _wallet, id);
        } else if (assetType == AssetType.ERC1155) {
            IERC1155(assetAddr).safeTransferFrom(
                address(this),
                _wallet,
                id,
                value,
                ""
            );
        }
    }

    function approveFunds(
        uint256[] calldata values,
        address[] calldata assets
    ) external override onlyWallet {
        require(
            values.length == assets.length,
            "Non matching input array lengths"
        );
        for (uint256 i = 0; i < values.length; i++) {
            require(
                IERC20(assets[i]).approve(_wallet, values[i]),
                "Approval failed"
            );
        }
    }

    function makeDeposit(
        Deposit calldata deposit
    ) public override onlyWallet returns (bool) {
        (AssetType assetType, address assetAddr, uint256 id) = Utils
            ._decodeAsset(deposit.encodedAddr, deposit.encodedId);
        if (assetType == AssetType.ERC20) {
            return
                IERC20(assetAddr).transferFrom(
                    deposit.spender,
                    address(this),
                    deposit.value
                );
        } else if (assetType == AssetType.ERC721) {
            try
                IERC721(assetAddr).transferFrom(
                    deposit.spender,
                    address(this),
                    id
                )
            {
                return true;
            } catch {
                return false;
            }
        } else if (assetType == AssetType.ERC1155) {
            try
                IERC1155(assetAddr).safeTransferFrom(
                    deposit.spender,
                    address(this),
                    id,
                    deposit.value,
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

    function onERC721Received(
        address, // operator
        address, // from
        uint256, // tokenId
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

    // TODO: fix this
    function supportsInterface(
        bytes4 // interfaceId
    ) external pure override returns (bool) {
        return false;
    }
}
