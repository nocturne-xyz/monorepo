// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;
pragma abicoder v2;

import "./CommitmentTreeManager.sol";
import {IWallet} from "./interfaces/IWallet.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721ReceiverUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/IERC1155ReceiverUpgradeable.sol";
import {Utils} from "./libs/Utils.sol";
import {AssetUtils} from "./libs/AssetUtils.sol";
import {OperationUtils} from "./libs/OperationUtils.sol";
import "./libs/Types.sol";
import "./OperationReentrancyGuard.sol";

contract BalanceManager is
    IERC721ReceiverUpgradeable,
    IERC1155ReceiverUpgradeable,
    CommitmentTreeManager,
    OperationReentrancyGuard
{
    using OperationLib for Operation;

    IWallet public _wallet;

    EncodedAsset[] public _receivedAssets;

    // gap for upgrade safety
    uint256[50] private __GAP;

    function __BalanceManager_init(
        address wallet,
        address subtreeUpdateVerifier
    ) internal onlyInitializing {
        __OperationReentrancyGuard_init();
        __CommitmentTreeManager_init(subtreeUpdateVerifier);
        _wallet = IWallet(wallet);
    }

    function onERC721Received(
        address, // operator
        address, // from
        uint256 id,
        bytes calldata // data
    ) external override returns (bytes4) {
        // Must reject the transfer outside of an operation processing
        if (reentrancyGuardStage() == NO_OPERATION_ENTERED) {
            return 0;
        }

        // Record the transfer if it results from executed actions
        if (reentrancyGuardStage() == ENTERED_EXECUTE_ACTIONS) {
            _receivedAssets.push(
                AssetUtils.encodeAsset(AssetType.ERC721, msg.sender, id)
            );
        }
        // Accept the transfer when _operation_stage != _NOT_ENTERED
        return IERC721ReceiverUpgradeable.onERC721Received.selector;
    }

    function onERC1155Received(
        address, // operator
        address, // from
        uint256 id,
        uint256, // value
        bytes calldata // data
    ) external override returns (bytes4) {
        // Must reject the transfer outside of an operation processing
        if (reentrancyGuardStage() == NO_OPERATION_ENTERED) {
            return 0;
        }

        // Record the transfer if it results from executed actions
        if (reentrancyGuardStage() == ENTERED_EXECUTE_ACTIONS) {
            _receivedAssets.push(
                AssetUtils.encodeAsset(AssetType.ERC1155, msg.sender, id)
            );
        }

        // ENTERED_PROCESS is ok because this is when wallet funds handler
        return IERC1155ReceiverUpgradeable.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address, // operator
        address, // from
        uint256[] calldata ids,
        uint256[] calldata, // values
        bytes calldata // data
    ) external override returns (bytes4) {
        // Must reject the transfer outside of an operation processing
        if (reentrancyGuardStage() == NO_OPERATION_ENTERED) {
            return 0;
        }

        // Record the transfer if it results from executed actions
        if (reentrancyGuardStage() == ENTERED_EXECUTE_ACTIONS) {
            uint256 numIds = ids.length;
            for (uint256 i = 0; i < numIds; i++) {
                _receivedAssets.push(
                    AssetUtils.encodeAsset(
                        AssetType.ERC1155,
                        msg.sender,
                        ids[i]
                    )
                );
            }
        }

        // ENTERED_PROCESS is ok because this is when wallet funds handler
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

    /**
      Process all joinSplits and request all declared publicSpend from the
      wallet, while reserving maxGasAssetCost of gasAsset (asset of joinsplitTxs[0])

      @dev If this function returns normally without reverting, then it is safe
      to request maxGasAssetCost from wallet with the same encodedAsset as
      joinSplits[0].
    */
    function _processJoinSplitsReservingFee(
        Operation calldata op,
        uint256 perJoinSplitVerifyGas
    ) internal {
        EncodedAsset calldata encodedGasAsset = op.encodedGasAsset;
        uint256 gasAssetToReserve = op.maxGasAssetCost(perJoinSplitVerifyGas);

        uint256 numJoinSplits = op.joinSplits.length;
        for (uint256 i = 0; i < numJoinSplits; i++) {
            // Process nullifiers in the current joinSplit, will throw if
            // they are not fresh
            _handleJoinSplit(op.joinSplits[i]);

            // Defaults to requesting all publicSpend from wallet
            uint256 valueToTransfer = op.joinSplits[i].publicSpend;
            // If we still need to reserve more gas and the current
            // `joinSplit` is spending the gasAsset, then reserve what we can
            // from this `joinSplit`
            if (
                gasAssetToReserve > 0 &&
                AssetUtils.eq(encodedGasAsset, op.joinSplits[i].encodedAsset)
            ) {
                // We will reserve as much as we can, upto the public spend
                // amount or the maximum amount to be reserved
                uint256 gasPaymentThisJoinSplit = Utils.min(
                    op.joinSplits[i].publicSpend,
                    gasAssetToReserve
                );
                // Deduct gas payment from value to transfer to wallet
                valueToTransfer -= gasPaymentThisJoinSplit;
                // Deduct gas payment from the amount to be reserved
                gasAssetToReserve -= gasPaymentThisJoinSplit;
            }

            // If value to transfer is 0, skip the transfer
            if (valueToTransfer > 0) {
                _wallet.requestAsset(
                    op.joinSplits[i].encodedAsset,
                    valueToTransfer
                );
            }
        }
        require(gasAssetToReserve == 0, "Too few gas tokens");
    }

    function _gatherReservedGasAssetAndPayBundler(
        Operation calldata op,
        OperationResult memory opResult,
        uint256 perJoinSplitVerifyGas,
        address bundler
    ) internal {
        // Gas asset is assumed to be the asset of the first jointSplitTx by convention
        EncodedAsset calldata encodedGasAsset = op.encodedGasAsset;
        uint256 gasAssetAmount = op.maxGasAssetCost(perJoinSplitVerifyGas);

        if (gasAssetAmount > 0) {
            // Request reserved gasAssetAmount from wallet.
            /// @dev This is safe because _processJoinSplitsReservingFee is
            /// guaranteed to have reserved gasAssetAmount since it didn't throw.
            _wallet.requestAsset(encodedGasAsset, gasAssetAmount);

            uint256 bundlerPayout = OperationUtils
                .calculateBundlerGasAssetPayout(op, opResult);
            AssetUtils.transferAssetTo(encodedGasAsset, bundler, bundlerPayout);
        }
    }

    /**
      Get the total number of refunds to handle after making external action calls.
      @dev This should only be called AFTER external calls have been made during action execution.
    */
    function _totalNumRefundsToHandle(
        Operation calldata op
    ) internal view returns (uint256) {
        return
            op.joinSplits.length +
            op.encodedRefundAssets.length +
            _receivedAssets.length;
    }

    /**
      Refund all current wallet assets back to refundAddr. The list of assets
      to refund is specified in joinSplits and the state variable
      _receivedAssets.
    */
    function _handleAllRefunds(Operation calldata op) internal {
        uint256 numJoinSplits = op.joinSplits.length;
        for (uint256 i = 0; i < numJoinSplits; i++) {
            _handleRefundForAsset(op.joinSplits[i].encodedAsset, op.refundAddr);
        }

        uint256 numRefundAssets = op.encodedRefundAssets.length;
        for (uint256 i = 0; i < numRefundAssets; i++) {
            _handleRefundForAsset(op.encodedRefundAssets[i], op.refundAddr);
        }

        uint256 numReceived = _receivedAssets.length;
        for (uint256 i = 0; i < numReceived; i++) {
            _handleRefundForAsset(_receivedAssets[i], op.refundAddr);
        }
        delete _receivedAssets;
    }

    function _handleRefundForAsset(
        EncodedAsset memory encodedAsset,
        StealthAddress calldata refundAddr
    ) internal {
        uint256 value = AssetUtils.balanceOfAsset(encodedAsset);
        if (value != 0) {
            AssetUtils.transferAssetTo(encodedAsset, address(_wallet), value);
            _handleRefundNote(encodedAsset, refundAddr, value);
        }
    }
}
