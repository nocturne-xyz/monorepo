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
import {WalletUtils} from "./libs/WalletUtils.sol";
import {AssetUtils} from "./libs/AssetUtils.sol";
import "./libs/types.sol";

contract BalanceManager is
    IERC721Receiver,
    IERC1155Receiver,
    CommitmentTreeManager
{
    using OperationLib for Operation;

    EncodedAsset[] public _receivedAssets;
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

    /**
      Process all joinSplitTxs and request all declared publicSpend from the
      vault, while reserving maxGasFee of gasAsset (asset of joinsplitTxs[0])

      @dev If this function returns normally without reverting, then it is safe
      to request maxGasFee from vault with the same encodedAsset as
      joinSplitTxs[0].
    */
    function _processJoinSplitTxsReservingFee(Operation calldata op) internal {
        EncodedAsset memory encodedGasToken = op.gasToken();
        uint256 gasTokensToReserve = op.maxGasTokenCost();

        uint256 numJoinSplits = op.joinSplitTxs.length;
        for (uint256 i = 0; i < numJoinSplits; i++) {
            // Process nullifiers in the current joinSplitTx, will throw if
            // they are not fresh
            _handleJoinSplit(op.joinSplitTxs[i]);

            // Defaults to requesting all publicSpend from vault
            uint256 valueToTransfer = op.joinSplitTxs[i].publicSpend;
            // If we still need to reserve more gas and the current
            // `joinSplitTx` is spending the gasAsset, then reserve what we can
            // from this `joinSplitTx`
            if (
                gasTokensToReserve > 0 &&
                encodedGasToken.encodedAssetAddr ==
                op.joinSplitTxs[i].encodedAssetAddr &&
                encodedGasToken.encodedAssetId ==
                op.joinSplitTxs[i].encodedAssetId
            ) {
                // We will reserve as much as we can, upto the public spend
                // amount or the maximum amount to be reserved
                uint256 gasPaymentThisJoinSplit = Utils.min(
                    op.joinSplitTxs[i].publicSpend,
                    gasTokensToReserve
                );
                // Deduct gas payment from value to transfer to wallet
                valueToTransfer -= gasPaymentThisJoinSplit;
                // Deduct gas payment from the amoung to be reserved
                gasTokensToReserve -= gasPaymentThisJoinSplit;
            }

            // If value to transfer is 0, skip the trasnfer
            if (valueToTransfer > 0) {
                _vault.requestAsset(
                    EncodedAsset({
                        encodedAssetAddr: op.joinSplitTxs[i].encodedAssetAddr,
                        encodedAssetId: op.joinSplitTxs[i].encodedAssetId
                    }),
                    valueToTransfer
                );
            }
        }
        require(gasTokensToReserve == 0, "Not enough gas tokens unwrapped.");
    }

    function _handleGasPayment(
        Operation calldata op,
        uint256 verificationGasUsed,
        uint256 executionGasUsed,
        address bundler
    ) internal {
        // Gas asset is assumed to be the asset of the first jointSplitTx by convention
        GasPayment memory maxGasPayment = op.maxGasTokenPayment();

        // Request reserved maxGasFee from vault.
        /// @dev This is safe because _processJoinSplitTxsReservingFee is
        /// guaranteed to have reserved maxGasFee since it didn't throw.
        _vault.requestAsset(maxGasPayment.encodedAsset, maxGasPayment.amount);

        // Transfer used verification and execution gas to the bundler
        uint256 bundlerPayout = op.gasPrice *
            (executionGasUsed + verificationGasUsed);
        AssetUtils._transferAssetTo(
            maxGasPayment.encodedAsset,
            bundler,
            bundlerPayout
        );
    }

    /**
      Refund all current wallet assets back to refundAddr. The list of assets
      to refund is specified in joinSplitTxs and the state variable
      _receivedAssets.
    */
    function _handleAllRefunds(Operation calldata op) internal {
        uint256 numJoinSplits = op.joinSplitTxs.length;
        uint256 numReceived = _receivedAssets.length;
        uint256 numRefunds = numJoinSplits + numReceived;

        // @dev Revert if number of refund requested is too large
        require(numRefunds <= op.maxNumRefunds, "maxNumRefunds is too small.");

        EncodedAsset[] memory assetsToProcess = new EncodedAsset[](numRefunds);
        for (uint256 i = 0; i < numJoinSplits; i++) {
            assetsToProcess[i] = EncodedAsset({
                encodedAssetAddr: op.joinSplitTxs[i].encodedAssetAddr,
                encodedAssetId: op.joinSplitTxs[i].encodedAssetId
            });
        }
        for (uint256 i = 0; i < numReceived; i++) {
            assetsToProcess[numJoinSplits + i] = _receivedAssets[i];
        }
        delete _receivedAssets;

        for (uint256 i = 0; i < numRefunds; i++) {
            uint256 value = AssetUtils._balanceOfAsset(assetsToProcess[i]);
            if (value != 0) {
                AssetUtils._transferAssetTo(
                    assetsToProcess[i],
                    address(_vault),
                    value
                );
                _handleRefundNote(
                    op.refundAddr,
                    assetsToProcess[i].encodedAssetAddr,
                    assetsToProcess[i].encodedAssetId,
                    value
                );
            }
        }
    }
}
