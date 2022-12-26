// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;
pragma abicoder v2;

import "./CommitmentTreeManager.sol";
import {IVault} from "./interfaces/IVault.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import {Utils} from "./libs/Utils.sol";
import {AssetUtils} from "./libs/AssetUtils.sol";
import "./libs/types.sol";

contract BalanceManager is
    IERC721Receiver,
    IERC1155Receiver,
    CommitmentTreeManager
{
    EncodedAsset[] _receivedTokens;
    IVault public immutable _vault;

    constructor(
        address vault,
        address joinSplitVerifier,
        address _subtreeUpdateVerifier
    ) CommitmentTreeManager(joinSplitVerifier, _subtreeUpdateVerifier) {
        _vault = IVault(vault);
    }

    function onERC721Received(
        address, // operator
        address, // from
        uint256 id,
        bytes calldata // data
    ) external override returns (bytes4) {
        _receivedTokens.push(
            AssetUtils._encodeAsset(AssetType.ERC721, msg.sender, id)
        );
        return IERC721Receiver.onERC721Received.selector;
    }

    function onERC1155Received(
        address, // operator
        address, // from
        uint256 id,
        uint256, // value
        bytes calldata // data
    ) external override returns (bytes4) {
        _receivedTokens.push(
            AssetUtils._encodeAsset(AssetType.ERC1155, msg.sender, id)
        );
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
            _receivedTokens.push(
                AssetUtils._encodeAsset(AssetType.ERC1155, msg.sender, ids[i])
            );
        }
        return IERC1155Receiver.onERC1155BatchReceived.selector;
    }

    // TODO: fix this
    function supportsInterface(
        bytes4 // interfaceId
    ) external pure override returns (bool) {
        return false;
    }

    function _makeDeposit(Deposit calldata deposit) internal {
        NocturneAddress calldata depositAddr = deposit.depositAddr;

        _handleRefundNote(
            depositAddr,
            deposit.encodedAddr,
            deposit.encodedId,
            deposit.value
        );

        require(_vault.makeDeposit(deposit), "Deposit failed");
    }

    // Process all joinSplitTxs and request all declared publicSpend from
    // the vault, while reserving maxGasFee of gasAsset (asset of joinsplitTxs[0])
    function _handleAllSpends(
        JoinSplitTransaction[] calldata joinSplitTxs,
        uint256 maxGasFee
    ) internal {
        uint256 gasLeftToReserve = maxGasFee;
        uint256 gasAssetAddr = joinSplitTxs[0].encodedAddr;
        uint256 gasAssetId = joinSplitTxs[0].encodedId;
        for (uint256 i = 0; i < joinSplitTxs.length; i++) {
            _handleJoinSplit(joinSplitTxs[i]);
            uint256 valueToTransfer = joinSplitTxs[i].publicSpend;
            // Try to reserve gas fee if there's more to reserve and this
            // joinSplitTx is spending the gasAsset
            if (
                gasLeftToReserve > 0 &&
                gasAssetAddr == joinSplitTxs[i].encodedAddr &&
                gasAssetId == joinSplitTxs[i].encodedId
            ) {
                // We will reserve as much as we can, upto the public spend
                // amount or the maximum amount to be reserved
                uint256 gasPaymentThisJoinSplit = Utils.min(
                    joinSplitTxs[i].publicSpend,
                    gasLeftToReserve
                );
                // Deduct gas payment from value to transfer to wallet
                valueToTransfer -= gasPaymentThisJoinSplit;
                // Deduct gas payment from the amoung to be reserved
                gasLeftToReserve -= gasPaymentThisJoinSplit;
            }
            // No need to process the transfer of "0" value
            if (valueToTransfer > 0) {
                _vault.requestAsset(
                    EncodedAsset({
                        encodedAddr: joinSplitTxs[i].encodedAddr,
                        encodedId: joinSplitTxs[i].encodedId
                    }),
                    valueToTransfer
                );
            }
        }
        require(gasLeftToReserve == 0, "Not enough gas tokens unwrapped.");
    }

    function _handleAllRefunds(
        JoinSplitTransaction[] calldata joinSplitTxs,
        NocturneAddress calldata refundAddr
    ) internal {
        uint256 numRefunds = joinSplitTxs.length + _receivedTokens.length;

        EncodedAsset[] memory tokensToProcess = new EncodedAsset[](numRefunds);
        for (uint256 i = 0; i < joinSplitTxs.length; i++) {
            tokensToProcess[i] = EncodedAsset({
                encodedAddr: joinSplitTxs[i].encodedAddr,
                encodedId: joinSplitTxs[i].encodedId
            });
        }
        for (uint256 i = 0; i < _receivedTokens.length; i++) {
            tokensToProcess[joinSplitTxs.length + i] = _receivedTokens[i];
        }
        delete _receivedTokens;

        for (uint256 i = 0; i < tokensToProcess.length; i++) {
            uint256 value = AssetUtils._balanceOfAsset(tokensToProcess[i]);
            if (value != 0) {
                AssetUtils._transferAssetTo(
                    tokensToProcess[i],
                    address(_vault),
                    value
                );
                _handleRefundNote(
                    refundAddr,
                    tokensToProcess[i].encodedAddr,
                    tokensToProcess[i].encodedId,
                    value
                );
            }
        }
    }
}
