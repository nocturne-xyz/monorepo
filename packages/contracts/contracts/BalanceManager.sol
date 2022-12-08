// SPDX-License-Identifier: MIT
pragma solidity ^0.8.5;
pragma abicoder v2;

import "./CommitmentTreeManager.sol";
import "./interfaces/IVault.sol";
import "./interfaces/IWallet.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import {Utils} from "./libs/Utils.sol";

contract BalanceManager is
    IERC721Receiver,
    IERC1155Receiver,
    CommitmentTreeManager
{
    IWallet.WalletBalanceInfo balanceInfo; // solhint-disable-line state-visibility
    IVault public vault;

    constructor(
        address _vault,
        address _joinSplitVerifier,
        address _subtreeUpdateVerifier
    ) CommitmentTreeManager(_joinSplitVerifier, _subtreeUpdateVerifier) {
        vault = IVault(_vault);
    }

    function onERC721Received(
        address, // operator
        address, // from
        uint256 _tokenId,
        bytes calldata // data
    ) external override returns (bytes4) {
        if (balanceInfo.erc721Ids[msg.sender].length == 0) {
            balanceInfo.erc721Addresses.push(msg.sender);
        }
        balanceInfo.erc721Ids[msg.sender].push(_tokenId);
        return IERC721Receiver.onERC721Received.selector;
    }

    function onERC1155Received(
        address, // operator
        address, // from
        uint256 _id,
        uint256, // value
        bytes calldata // data
    ) external override returns (bytes4) {
        if (balanceInfo.erc1155Ids[msg.sender].length == 0) {
            balanceInfo.erc1155Addresses.push(msg.sender);
        }
        balanceInfo.erc1155Ids[msg.sender].push(_id);
        return IERC1155Receiver.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address, // operator
        address, // from
        uint256[] calldata _ids,
        uint256[] calldata, // values
        bytes calldata // data
    ) external override returns (bytes4) {
        for (uint256 i = 0; i < _ids.length; i++) {
            if (balanceInfo.erc1155Ids[msg.sender].length == 0) {
                balanceInfo.erc1155Addresses.push(msg.sender);
            }
            balanceInfo.erc1155Ids[msg.sender].push(_ids[i]);
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
        IWallet.Deposit[] memory _approvedDeposits,
        uint256 _numApprovedDeposits
    ) internal {
        (
            uint256[] memory _successfulTransfers,
            uint256 _numSuccessfulTransfer
        ) = vault.makeBatchDeposit(_approvedDeposits, _numApprovedDeposits);

        for (uint256 i = 0; i < _numSuccessfulTransfer; i++) {
            uint256 _index = _successfulTransfers[i];
            IWallet.NocturneAddress memory _depositAddr = _approvedDeposits[
                _index
            ].depositAddr;

            _handleRefund(
                _depositAddr,
                _approvedDeposits[_index].asset,
                _approvedDeposits[_index].id,
                _approvedDeposits[_index].value
            );
        }
    }

    function _makeDeposit(IWallet.Deposit calldata _deposit) internal {
        IWallet.NocturneAddress calldata _depositAddr = _deposit.depositAddr;

        _handleRefund(
            _depositAddr,
            _deposit.asset,
            _deposit.id,
            _deposit.value
        );

        require(vault.makeDeposit(_deposit), "Deposit failed");
    }

    // TODO: Fix below according to design doc
    function _handleAllSpends(
        IWallet.JoinSplitTransaction[] calldata _joinSplitTxs,
        IWallet.Tokens calldata _tokens,
        uint256 _operationDigest
    ) internal {
        uint256 _numSpendTxs = _joinSplitTxs.length;

        for (uint256 i = 0; i < _numSpendTxs; i++) {
            _handleJoinSplit(_joinSplitTxs[i], _operationDigest);
            if (_joinSplitTxs[i].id == Utils.SNARK_SCALAR_FIELD - 1) {
                balanceInfo.erc20Balances[
                    _joinSplitTxs[i].asset
                ] += _joinSplitTxs[i].publicSpend;
            } else if (_joinSplitTxs[i].publicSpend == 0) {
                _gatherERC721(_joinSplitTxs[i].asset, _joinSplitTxs[i].id);
            } else {
                _gatherERC1155(
                    _joinSplitTxs[i].asset,
                    _joinSplitTxs[i].id,
                    _joinSplitTxs[i].publicSpend
                );
            }
        }

        _gatherERC20s(_tokens.spendTokens);

        // reset ERC20 balances
        for (uint256 i = 0; i < _numSpendTxs; i++) {
            balanceInfo.erc20Balances[_joinSplitTxs[i].asset] = 0;
        }
    }

    function _handleAllRefunds(
        address[] calldata _spendTokens,
        address[] calldata _refundTokens,
        IWallet.NocturneAddress calldata _refundAddr
    ) internal {
        _handleERC20Refunds(_spendTokens, _refundTokens, _refundAddr);

        _handleERC721Refunds(_refundAddr);

        _handleERC1155Refunds(_refundAddr);
    }

    function _handleERC20Refunds(
        address[] calldata _spendTokens,
        address[] calldata _refundTokens,
        IWallet.NocturneAddress calldata _refundAddr
    ) internal {
        for (uint256 i = 0; i < _spendTokens.length; i++) {
            uint256 _newBal = IERC20(_spendTokens[i]).balanceOf(address(this));

            if (_newBal != 0) {
                _handleRefund(
                    _refundAddr,
                    _spendTokens[i],
                    Utils.SNARK_SCALAR_FIELD - 1,
                    _newBal
                );
                require(
                    IERC20(_spendTokens[i]).transfer(address(vault), _newBal),
                    "Error sending funds to vault"
                );
            }
        }

        for (uint256 i = 0; i < _refundTokens.length; i++) {
            // should be 0 if already refunded as left over spend tokens
            uint256 _bal = IERC20(_refundTokens[i]).balanceOf(address(this));
            if (_bal != 0) {
                _handleRefund(
                    _refundAddr,
                    _refundTokens[i],
                    Utils.SNARK_SCALAR_FIELD - 1,
                    _bal
                );
                require(
                    IERC20(_refundTokens[i]).transfer(address(vault), _bal),
                    "Error sending funds to vault"
                );
            }
        }
    }

    function _handleERC721Refunds(
        IWallet.NocturneAddress calldata _refundAddr
    ) internal {
        for (uint256 i = 0; i < balanceInfo.erc721Addresses.length; i++) {
            address _tokenAddress = balanceInfo.erc721Addresses[i];
            uint256[] memory _ids = balanceInfo.erc721Ids[_tokenAddress];
            for (uint256 k = 0; k < _ids.length; k++) {
                if (IERC721(_tokenAddress).ownerOf(_ids[k]) == address(this)) {
                    _handleRefund(_refundAddr, _tokenAddress, _ids[k], 0);
                    IERC721(_tokenAddress).transferFrom(
                        address(this),
                        address(vault),
                        _ids[k]
                    );
                }
            }
            delete balanceInfo.erc721Ids[balanceInfo.erc721Addresses[i]];
        }
        delete balanceInfo.erc721Addresses;
    }

    function _handleERC1155Refunds(
        IWallet.NocturneAddress calldata _refundAddr
    ) internal {
        for (uint256 i = 0; i < balanceInfo.erc1155Addresses.length; i++) {
            address _tokenAddress = balanceInfo.erc1155Addresses[i];
            uint256[] memory _ids = balanceInfo.erc1155Ids[_tokenAddress];
            for (uint256 k = 0; k < _ids.length; k++) {
                uint256 _currBal = IERC1155(_tokenAddress).balanceOf(
                    address(this),
                    _ids[k]
                );
                if (_currBal != 0) {
                    _handleRefund(
                        _refundAddr,
                        _tokenAddress,
                        _ids[k],
                        _currBal
                    );
                    IERC1155(_tokenAddress).safeTransferFrom(
                        address(this),
                        address(vault),
                        _ids[k],
                        _currBal,
                        ""
                    );
                }
            }
            delete balanceInfo.erc1155Ids[balanceInfo.erc1155Addresses[i]];
        }
        delete balanceInfo.erc1155Addresses;
    }

    function _gatherERC20s(address[] calldata _tokens) internal {
        uint256[] memory _amts = new uint256[](_tokens.length);
        for (uint256 i = 0; i < _tokens.length; i++) {
            _amts[i] = balanceInfo.erc20Balances[_tokens[i]];
        }

        vault.requestERC20s(_tokens, _amts);
    }

    function _gatherERC721(address _tokenAddress, uint256 _id) internal {
        vault.requestERC721(_tokenAddress, _id);
    }

    function _gatherERC1155(
        address _tokenAddress,
        uint256 _id,
        uint256 _value
    ) internal {
        vault.requestERC1155(_tokenAddress, _id, _value);
    }
}
