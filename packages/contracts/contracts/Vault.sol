//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "./interfaces/IVault.sol";
import "./interfaces/IWallet.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";

import "hardhat/console.sol";

contract Vault is IVault, IERC721Receiver, IERC1155Receiver {
    uint256 public constant SNARK_SCALAR_FIELD =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;

    address public wallet;

    modifier onlyTeller() {
        require(msg.sender == wallet, "Not called from Teller");
        _;
    }

    // TODO: deployment can be front run
    function initialize(address _teller) external {
        require(wallet == address(0), "Vault already initialized");
        wallet = _teller;
    }

    function requestERC20s(
        address[] calldata assetAddresses,
        uint256[] calldata values
    ) external override onlyTeller {
        require(
            values.length == assetAddresses.length,
            "Non matching input array lengths"
        );
        for (uint256 i = 0; i < values.length; i++) {
            if (values[i] != 0) {
                require(
                    IERC20(assetAddresses[i]).transfer(wallet, values[i]),
                    "Transfer failed"
                );
            }
        }
    }

    function requestERC721(address assetAddress, uint256 id)
        external
        override
        onlyTeller
    {
        IERC721(assetAddress).safeTransferFrom(address(this), wallet, id);
    }

    function requestERC1155(
        address assetAddress,
        uint256 id,
        uint256 value
    ) external override onlyTeller {
        IERC1155(assetAddress).safeTransferFrom(
            address(this),
            wallet,
            id,
            value,
            ""
        );
    }

    function approveFunds(uint256[] calldata values, address[] calldata assets)
        external
        override
        onlyTeller
    {
        require(
            values.length == assets.length,
            "Non matching input array lengths"
        );
        for (uint256 i = 0; i < values.length; i++) {
            require(
                IERC20(assets[i]).approve(wallet, values[i]),
                "Approval failed"
            );
        }
    }

    // TODO: alter array length in memory, so that we don't have to return the array length
    function makeBatchDeposit(
        IWallet.Deposit[] calldata deposits,
        uint256 numApprovedDeposits
    ) external override onlyTeller returns (uint256[] memory, uint256) {
        uint256[] memory successfulTransfers = new uint256[](
            numApprovedDeposits
        );
        uint256 numSuccessfulTransfers = 0;
        for (uint256 i = 0; i < numApprovedDeposits; i++) {
            if (makeDeposit(deposits[i])) {
                successfulTransfers[numSuccessfulTransfers] = i;
                numSuccessfulTransfers++;
            }
        }

        return (successfulTransfers, numSuccessfulTransfers);
    }

    function makeDeposit(IWallet.Deposit calldata deposit)
        public
        override
        onlyTeller
        returns (bool)
    {
        if (deposit.id == SNARK_SCALAR_FIELD - 1) {
            return
                IERC20(deposit.asset).transferFrom(
                    deposit.spender,
                    address(this),
                    deposit.value
                );
        } else if (deposit.value == 0) {
            try
                IERC721(deposit.asset).transferFrom(
                    deposit.spender,
                    address(this),
                    deposit.id
                )
            {
                return true;
            } catch {
                return false;
            }
        } else {
            try
                IERC1155(deposit.asset).safeTransferFrom(
                    deposit.spender,
                    address(this),
                    deposit.id,
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
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) external override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    function onERC1155Received(
        address operator,
        address from,
        uint256 id,
        uint256 value,
        bytes calldata data
    ) external override returns (bytes4) {
        return IERC1155Receiver.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address operator,
        address from,
        uint256[] calldata ids,
        uint256[] calldata values,
        bytes calldata data
    ) external override returns (bytes4) {
        return IERC1155Receiver.onERC1155BatchReceived.selector;
    }

    // TODO: fix this
    function supportsInterface(bytes4 interfaceId)
        external
        view
        override
        returns (bool)
    {
        return false;
    }
}
