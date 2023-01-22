// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;
pragma abicoder v2;

import {IAccountant} from "./interfaces/IAccountant.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721ReceiverUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/IERC1155ReceiverUpgradeable.sol";
import {Utils} from "./libs/Utils.sol";
import {AssetUtils} from "./libs/AssetUtils.sol";
import {WalletUtils} from "./libs/WalletUtils.sol";
import "./libs/types.sol";
import "./NocturneReentrancyGuard.sol";

contract BalanceManager is
    IERC721ReceiverUpgradeable,
    IERC1155ReceiverUpgradeable,
    NocturneReentrancyGuard
{
    using OperationLib for Operation;

    IAccountant public _accountant;

    EncodedAsset[] public _receivedAssets;

    // gap for upgrade safety
    uint256[50] private __GAP;

    function __BalanceManager__init(
        address accountant
    ) public onlyInitializing {
        __NocturneReentrancyGuard_init();
        _accountant = IAccountant(accountant);
    }

    function onERC721Received(
        address, // operator
        address, // from
        uint256 id,
        bytes calldata // data
    ) external override returns (bytes4) {
        // Must reject the transfer outside of an operation
        if (reentrancyGuardStage() == NOT_ENTERED) {
            return 0;
        }
        // Record the transfer if it results from executed actions
        if (reentrancyGuardStage() == ENTERED_EXECUTE_OPERATION) {
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
        // Must reject the transfer outside of an operation
        if (reentrancyGuardStage() == NOT_ENTERED) {
            return 0;
        }
        // Record the transfer if it results from executed actions
        if (reentrancyGuardStage() == ENTERED_EXECUTE_OPERATION) {
            _receivedAssets.push(
                AssetUtils.encodeAsset(AssetType.ERC1155, msg.sender, id)
            );
        }
        // Accept the transfer when _operation_stage != _NOT_ENTERED
        return IERC1155ReceiverUpgradeable.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address, // operator
        address, // from
        uint256[] calldata ids,
        uint256[] calldata, // values
        bytes calldata // data
    ) external override returns (bytes4) {
        // Must reject the transfer outside of an operation
        if (reentrancyGuardStage() == NOT_ENTERED) {
            return 0;
        }
        // Record the transfer if it results from executed actions
        if (reentrancyGuardStage() == ENTERED_EXECUTE_OPERATION) {
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
        // Accept the transfer when _operation_stage != _NOT_ENTERED
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
      Process all joinSplitTxs and request all declared publicSpend from the
      accountant, while reserving maxGasAssetCost of gasAsset (asset of joinsplitTxs[0])

      @dev If this function returns normally without reverting, then it is safe
      to request maxGasAssetCost from accountant with the same encodedAsset as
      joinSplitTxs[0].
    */
    function _processJoinSplitTxsReservingFee(Operation calldata op) internal {
        // Process all nullifiers in the current joinSplitTxs, will throw if
        // they are not fresh
        _accountant.handleJoinSplitsBatched(op.joinSplitTxs);

        EncodedAsset calldata encodedGasAsset = op.gasAsset();
        uint256 gasAssetToReserve = op.maxGasAssetCost();

        // Loop through validated joinsplits and request assets minus what's
        // needed for gas
        for (uint256 i = 0; i < op.joinSplitTxs.length; i++) {
            // Defaults to requesting all publicSpend from accountant
            uint256 valueToTransfer = op.joinSplitTxs[i].publicSpend;
            // If we still need to reserve more gas and the current
            // `joinSplitTx` is spending the gasAsset, then reserve what we can
            // from this `joinSplitTx`
            if (
                gasAssetToReserve > 0 &&
                AssetUtils.eq(encodedGasAsset, op.joinSplitTxs[i].encodedAsset)
            ) {
                // We will reserve as much as we can, upto the public spend
                // amount or the maximum amount to be reserved
                uint256 gasPaymentThisJoinSplit = Utils.min(
                    op.joinSplitTxs[i].publicSpend,
                    gasAssetToReserve
                );
                // Deduct gas payment from value to transfer to wallet
                valueToTransfer -= gasPaymentThisJoinSplit;
                // Deduct gas payment from the amount to be reserved
                gasAssetToReserve -= gasPaymentThisJoinSplit;
            }

            // If value to transfer is 0, skip the transfer
            if (valueToTransfer > 0) {
                _accountant.requestAsset(
                    op.joinSplitTxs[i].encodedAsset,
                    valueToTransfer
                );
            }
        }
        require(gasAssetToReserve == 0, "Too few gas tokens");
    }

    function _gatherReservedGasAssetAndPayBundler(
        Operation calldata op,
        OperationResult memory opResult,
        address bundler
    ) internal {
        // Gas asset is assumed to be the asset of the first jointSplitTx by convention
        EncodedAsset calldata encodedGasAsset = op.gasAsset();
        uint256 gasAssetAmount = op.maxGasAssetCost();

        // Request reserved gasAssetAmount from accountant.
        /// @dev This is safe because _processJoinSplitTxsReservingFee is
        /// guaranteed to have reserved gasAssetAmount since it didn't throw.
        _accountant.requestAsset(encodedGasAsset, gasAssetAmount);

        uint256 bundlerPayout = WalletUtils.calculateBundlerGasAssetPayout(
            op,
            opResult
        );
        AssetUtils.transferAssetTo(encodedGasAsset, bundler, bundlerPayout);
    }

    /**
      Get the total number of refunds to handle after making external action calls.
      @dev This should only be called AFTER external calls have been made during action execution.
    */
    function _totalNumRefundsToHandle(
        Operation calldata op
    ) internal view returns (uint256) {
        uint256 numJoinSplits = op.joinSplitTxs.length;
        uint256 numRefundAssets = op.encodedRefundAssets.length;
        uint256 numReceived = _receivedAssets.length;
        return numJoinSplits + numRefundAssets + numReceived;
    }

    /**
      Refund all current wallet assets back to refundAddr. The list of assets
      to refund is specified in joinSplitTxs and the state variable
      _receivedAssets.
    */
    function _handleAllRefunds(Operation calldata op) internal {
        // Gather all refund notes
        uint256 totalNumRefunds = _totalNumRefundsToHandle(op);
        RefundNote[] memory refunds = new RefundNote[](totalNumRefunds);

        uint256 numJoinSplitTxs = op.joinSplitTxs.length;
        for (uint256 i = 0; i < numJoinSplitTxs; i++) {
            EncodedAsset calldata encodedAsset = op
                .joinSplitTxs[i]
                .encodedAsset;
            uint256 value = AssetUtils.balanceOfAsset(encodedAsset);
            refunds[i] = RefundNote({encodedAsset: encodedAsset, value: value});
        }

        uint256 refundAssetsStartIndex = numJoinSplitTxs;
        uint256 numRefundAssets = op.encodedRefundAssets.length;
        for (uint256 i = 0; i < numRefundAssets; i++) {
            EncodedAsset calldata encodedAsset = op.encodedRefundAssets[i];
            uint256 value = AssetUtils.balanceOfAsset(encodedAsset);
            refunds[refundAssetsStartIndex + i] = RefundNote({
                encodedAsset: encodedAsset,
                value: value
            });
        }

        uint256 receivedStartIndex = numJoinSplitTxs + numRefundAssets;
        uint256 numReceived = _receivedAssets.length;
        for (uint256 i = 0; i < numReceived; i++) {
            EncodedAsset memory encodedAsset = _receivedAssets[i];
            uint256 value = AssetUtils.balanceOfAsset(encodedAsset);
            refunds[receivedStartIndex + i] = RefundNote({
                encodedAsset: encodedAsset,
                value: value
            });
        }
        delete _receivedAssets;

        // Transfer assets back to accountant
        for (uint256 i = 0; i < totalNumRefunds; i++) {
            uint256 value = refunds[i].value;
            if (value > 0) {
                AssetUtils.transferAssetTo(
                    refunds[i].encodedAsset,
                    address(_accountant),
                    value
                );
            }
        }

        // Insert note commitments for all refunds
        // NOTE: refund notes with value = 0 may be passed to _accountant, they
        // are ignored by accountant contract
        _accountant.handleRefundNotesBatched(refunds, op.refundAddr);
    }
}
