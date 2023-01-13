//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.17;
pragma abicoder v2;

import {IVault} from "./interfaces/IVault.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";

import {AssetUtils} from "./libs/AssetUtils.sol";
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
        AssetUtils._transferAssetTo(encodedAsset, _wallet, value);
    }

    function makeDeposit(Deposit calldata deposit) public override onlyWallet {
        AssetUtils._transferAssetFrom(
            EncodedAsset({
                encodedAssetAddr: deposit.encodedAssetAddr,
                encodedAssetId: deposit.encodedAssetId
            }),
            deposit.spender,
            deposit.value
        );
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

    function supportsInterface(
        bytes4 interfaceId
    ) external pure override returns (bool) {
        return
            (interfaceId == type(IERC165).interfaceId) ||
            (interfaceId == type(IERC721Receiver).interfaceId) ||
            (interfaceId == type(IERC1155Receiver).interfaceId);
    }
}
