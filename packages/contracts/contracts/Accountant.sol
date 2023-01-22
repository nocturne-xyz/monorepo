//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.17;
pragma abicoder v2;

import "./CommitmentTreeManager.sol";
import "./Vault.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721ReceiverUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/IERC1155ReceiverUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import {AssetUtils} from "./libs/AssetUtils.sol";
import "./libs/types.sol";

contract Accountant is
    CommitmentTreeManager,
    IERC721ReceiverUpgradeable,
    IERC1155ReceiverUpgradeable
{
    address public _wallet;

    // gap for upgrade safety
    uint256[50] private __GAP;

    modifier onlyWallet() {
        require(msg.sender == _wallet, "Not called from Wallet");
        _;
    }

    function initialize(address wallet) external initializer {
        _wallet = wallet;
    }

    function requestAsset(
        EncodedAsset calldata encodedAsset,
        uint256 value
    ) external onlyWallet {
        AssetUtils._transferAssetTo(encodedAsset, _wallet, value);
    }

    function makeDeposit(Deposit calldata deposit) public onlyWallet {
        AssetUtils._transferAssetFrom(
            EncodedAsset({
                encodedAssetAddr: deposit.encodedAssetAddr,
                encodedAssetId: deposit.encodedAssetId
            }),
            deposit.spender,
            deposit.value
        );

        _handleRefundNote(
            deposit.depositAddr,
            deposit.encodedAssetAddr,
            deposit.encodedAssetId,
            deposit.value
        );
    }

    function onERC721Received(
        address, // operator
        address, // from
        uint256, // tokenId
        bytes calldata // data
    ) external pure override returns (bytes4) {
        return IERC721ReceiverUpgradeable.onERC721Received.selector;
    }

    function onERC1155Received(
        address, // operator
        address, // from
        uint256, // id
        uint256, // value
        bytes calldata // data
    ) external pure override returns (bytes4) {
        return IERC1155ReceiverUpgradeable.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address, // operator
        address, // from
        uint256[] calldata, // ids
        uint256[] calldata, // values
        bytes calldata // data
    ) external pure override returns (bytes4) {
        return IERC1155ReceiverUpgradeable.onERC1155BatchReceived.selector;
    }

    function supportsInterface(
        bytes4 interfaceId
    ) external pure override returns (bool) {
        return
            (interfaceId == type(IERC165Upgradeable).interfaceId) ||
            (interfaceId == type(IERC721ReceiverUpgradeable).interfaceId) ||
            (interfaceId == type(IERC1155ReceiverUpgradeable).interfaceId);
    }
}
