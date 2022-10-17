// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;
pragma abicoder v2;

import "./CommitmentTreeManager.sol";
import "./interfaces/IVault.sol";
import "./interfaces/IWallet.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";

import {IHasherT3, IHasherT5, IHasherT6} from "./interfaces/IHasher.sol";

contract BalanceManager is
    IERC721Receiver,
    IERC1155Receiver,
    CommitmentTreeManager
{
    IWallet.WalletBalanceInfo balanceInfo; // solhint-disable-line state-visibility
    IVault public vault;
    IHasherT5 public hasherT5;

    constructor(
        address _vault,
        address _verifier,
        address _merkle,
        address _hasherT5,
        address _hasherT6
    ) CommitmentTreeManager(_verifier, _merkle, _hasherT6) {
        vault = IVault(_vault);
        hasherT5 = IHasherT5(_hasherT5);
    }

    function onERC721Received(
        address, // operator
        address, // from
        uint256 tokenId,
        bytes calldata // data
    ) external override returns (bytes4) {
        if (balanceInfo.erc721Ids[msg.sender].length == 0) {
            balanceInfo.erc721Addresses.push(msg.sender);
        }
        balanceInfo.erc721Ids[msg.sender].push(tokenId);
        return IERC721Receiver.onERC721Received.selector;
    }

    function onERC1155Received(
        address, // operator
        address, // from
        uint256 id,
        uint256, // value
        bytes calldata // data
    ) external override returns (bytes4) {
        if (balanceInfo.erc1155Ids[msg.sender].length == 0) {
            balanceInfo.erc1155Addresses.push(msg.sender);
        }
        balanceInfo.erc1155Ids[msg.sender].push(id);
        return IERC1155Receiver.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address, // operator
        address, // from
        uint256[] calldata ids,
        uint256[] calldata, // values
        bytes calldata // data
    ) external override returns (bytes4) {
        for (uint256 i = 0; i < ids.length; i++) {
            if (balanceInfo.erc1155Ids[msg.sender].length == 0) {
                balanceInfo.erc1155Addresses.push(msg.sender);
            }
            balanceInfo.erc1155Ids[msg.sender].push(ids[i]);
        }
        return IERC1155Receiver.onERC1155BatchReceived.selector;
    }

    // TODO: fix this
    function supportsInterface(
        bytes4 // interfaceId
    ) external view override returns (bool) {
        return false;
    }

    function _makeBatchDeposit(
        IWallet.Deposit[] memory approvedDeposits,
        uint256 numApprovedDeposits
    ) internal {
        (
            uint256[] memory successfulTransfers,
            uint256 numSuccessfulTransfer
        ) = vault.makeBatchDeposit(approvedDeposits, numApprovedDeposits);

        for (uint256 i = 0; i < numSuccessfulTransfer; i++) {
            uint256 index = successfulTransfers[i];
            IWallet.FLAXAddress memory depositAddr = approvedDeposits[index]
                .depositAddr;
            uint256 depositAddrHash = hasherT5.hash(
                [
                    depositAddr.h1X,
                    depositAddr.h1Y,
                    depositAddr.h2X,
                    depositAddr.h2Y
                ]
            );

            _handleRefund(
                depositAddrHash,
                approvedDeposits[index].asset,
                approvedDeposits[index].id,
                approvedDeposits[index].value
            );
        }
    }

    function _makeDeposit(IWallet.Deposit calldata deposit) internal {
        IWallet.FLAXAddress calldata depositAddr = deposit.depositAddr;
        uint256 depositAddrHash = hasherT5.hash(
            [depositAddr.h1X, depositAddr.h1Y, depositAddr.h2X, depositAddr.h2Y]
        );

        _handleRefund(
            depositAddrHash,
            deposit.asset,
            deposit.id,
            deposit.value
        );

        require(vault.makeDeposit(deposit), "Deposit failed");
    }

    function _handleAllSpends(
        IWallet.SpendTransaction[] calldata spendTxs,
        IWallet.Tokens calldata tokens,
        bytes32 operationHash
    ) internal {
        uint256 numSpendTxs = spendTxs.length;

        for (uint256 i = 0; i < numSpendTxs; i++) {
            _handleSpend(spendTxs[i], operationHash);
            if (spendTxs[i].id == SNARK_SCALAR_FIELD - 1) {
                balanceInfo.erc20Balances[spendTxs[i].asset] += spendTxs[i]
                    .value;
            } else if (spendTxs[i].value == 0) {
                _gatherERC721(spendTxs[i].asset, spendTxs[i].id);
            } else {
                _gatherERC1155(
                    spendTxs[i].asset,
                    spendTxs[i].id,
                    spendTxs[i].value
                );
            }
        }

        _gatherERC20s(tokens.spendTokens);

        // reset ERC20 balances
        for (uint256 i = 0; i < numSpendTxs; i++) {
            balanceInfo.erc20Balances[spendTxs[i].asset] = 0;
        }
    }

    function _handleAllRefunds(
        address[] calldata spendTokens,
        address[] calldata refundTokens,
        IWallet.FLAXAddress calldata refundAddr
    ) internal {
        uint256 refundAddrHash = hasherT5.hash(
            [refundAddr.h1X, refundAddr.h1Y, refundAddr.h2X, refundAddr.h2Y]
        );

        _handleERC20Refunds(spendTokens, refundTokens, refundAddrHash);

        _handleERC721Refunds(refundAddrHash);

        _handleERC1155Refunds(refundAddrHash);
    }

    function _handleERC20Refunds(
        address[] calldata spendTokens,
        address[] calldata refundTokens,
        uint256 refundAddrHash
    ) internal {
        for (uint256 i = 0; i < spendTokens.length; i++) {
            uint256 newBal = IERC20(spendTokens[i]).balanceOf(address(this));

            if (newBal != 0) {
                _handleRefund(
                    refundAddrHash,
                    spendTokens[i],
                    SNARK_SCALAR_FIELD - 1,
                    newBal
                );
                require(
                    IERC20(spendTokens[i]).transfer(address(vault), newBal),
                    "Error sending funds to vault"
                );
            }
        }

        for (uint256 i = 0; i < refundTokens.length; i++) {
            // should be 0 if already refunded as left over spend tokens
            uint256 bal = IERC20(refundTokens[i]).balanceOf(address(this));
            if (bal != 0) {
                _handleRefund(
                    refundAddrHash,
                    refundTokens[i],
                    SNARK_SCALAR_FIELD - 1,
                    bal
                );
                require(
                    IERC20(refundTokens[i]).transfer(address(vault), bal),
                    "Error sending funds to vault"
                );
            }
        }
    }

    function _handleERC721Refunds(uint256 refundAddrHash) internal {
        for (uint256 i = 0; i < balanceInfo.erc721Addresses.length; i++) {
            address tokenAddress = balanceInfo.erc721Addresses[i];
            uint256[] memory ids = balanceInfo.erc721Ids[tokenAddress];
            for (uint256 k = 0; k < ids.length; k++) {
                if (IERC721(tokenAddress).ownerOf(ids[k]) == address(this)) {
                    _handleRefund(refundAddrHash, tokenAddress, ids[k], 0);
                    IERC721(tokenAddress).transferFrom(
                        address(this),
                        address(vault),
                        ids[k]
                    );
                }
            }
            delete balanceInfo.erc721Ids[balanceInfo.erc721Addresses[i]];
        }
        delete balanceInfo.erc721Addresses;
    }

    function _handleERC1155Refunds(uint256 refundAddrHash) internal {
        for (uint256 i = 0; i < balanceInfo.erc1155Addresses.length; i++) {
            address tokenAddress = balanceInfo.erc1155Addresses[i];
            uint256[] memory ids = balanceInfo.erc1155Ids[tokenAddress];
            for (uint256 k = 0; k < ids.length; k++) {
                uint256 currBal = IERC1155(tokenAddress).balanceOf(
                    address(this),
                    ids[k]
                );
                if (currBal != 0) {
                    _handleRefund(
                        refundAddrHash,
                        tokenAddress,
                        ids[k],
                        currBal
                    );
                    IERC1155(tokenAddress).safeTransferFrom(
                        address(this),
                        address(vault),
                        ids[k],
                        currBal,
                        ""
                    );
                }
            }
            delete balanceInfo.erc1155Ids[balanceInfo.erc1155Addresses[i]];
        }
        delete balanceInfo.erc1155Addresses;
    }

    function _gatherERC20s(address[] calldata tokens) internal {
        uint256[] memory amts = new uint256[](tokens.length);
        for (uint256 i = 0; i < tokens.length; i++) {
            amts[i] = balanceInfo.erc20Balances[tokens[i]];
        }

        vault.requestERC20s(tokens, amts);
    }

    function _gatherERC721(address tokenAddress, uint256 id) internal {
        vault.requestERC721(tokenAddress, id);
    }

    function _gatherERC1155(
        address tokenAddress,
        uint256 id,
        uint256 value
    ) internal {
        vault.requestERC1155(tokenAddress, id, value);
    }
}
