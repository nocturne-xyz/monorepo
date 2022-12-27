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
    EncodedAsset[] _receivedAssets;
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
        _receivedAssets.push(
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
        _receivedAssets.push(
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
        uint256 numIds = ids.length;
        for (uint256 i = 0; i < numIds; i++) {
            _receivedAssets.push(
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
            deposit.encodedAssetAddr,
            deposit.encodedAssetId,
            deposit.value
        );

        _vault.makeDeposit(deposit);
    }

    // Process all joinSplitTxs and request all declared publicSpend from
    // the vault, while reserving maxGasFee of gasAsset (asset of joinsplitTxs[0])
    function _handleAllSpends(
        JoinSplitTransaction[] calldata joinSplitTxs,
        uint256 maxGasFee
    ) internal {
        uint256 gasLeftToReserve = maxGasFee;
        uint256 gasAssetAddr = joinSplitTxs[0].encodedAssetAddr;
        uint256 gasAssetId = joinSplitTxs[0].encodedAssetId;
        uint256 numJoinSplits = joinSplitTxs.length;
        for (uint256 i = 0; i < numJoinSplits; i++) {
            _handleJoinSplit(joinSplitTxs[i]);
            uint256 valueToTransfer = joinSplitTxs[i].publicSpend;
            // Try to reserve gas fee if there's more to reserve and this
            // joinSplitTx is spending the gasAsset
            if (
                gasLeftToReserve > 0 &&
                gasAssetAddr == joinSplitTxs[i].encodedAssetAddr &&
                gasAssetId == joinSplitTxs[i].encodedAssetId
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
                        encodedAssetAddr: joinSplitTxs[i].encodedAssetAddr,
                        encodedAssetId: joinSplitTxs[i].encodedAssetId
                    }),
                    valueToTransfer
                );
            }
        }
        require(gasLeftToReserve == 0, "Not enough gas tokens unwrapped.");
    }

    /**
      Refund all current wallet assets back to refundAddr. The list of assets
      to refund is specified in joinSplitTxs and the state variable
      _receivedAssets.
    */
    function _handleAllRefunds(
        JoinSplitTransaction[] calldata joinSplitTxs,
        NocturneAddress calldata refundAddr
    ) internal {
        uint256 numJoinSplits = joinSplitTxs.length;
        uint256 numReceived = _receivedAssets.length;
        uint256 numRefunds = numJoinSplits + numReceived;

        EncodedAsset[] memory tokensToProcess = new EncodedAsset[](numRefunds);
        for (uint256 i = 0; i < numJoinSplits; i++) {
            tokensToProcess[i] = EncodedAsset({
                encodedAssetAddr: joinSplitTxs[i].encodedAssetAddr,
                encodedAssetId: joinSplitTxs[i].encodedAssetId
            });
        }
        for (uint256 i = 0; i < numReceived; i++) {
            tokensToProcess[joinSplitTxs.length + i] = _receivedAssets[i];
        }
        delete _receivedAssets;

        for (uint256 i = 0; i < numRefunds; i++) {
            uint256 value = AssetUtils._balanceOfAsset(tokensToProcess[i]);
            if (value != 0) {
                AssetUtils._transferAssetTo(
                    tokensToProcess[i],
                    address(_vault),
                    value
                );
                _handleRefundNote(
                    refundAddr,
                    tokensToProcess[i].encodedAssetAddr,
                    tokensToProcess[i].encodedAssetId,
                    value
                );
            }
        }
    }
}
