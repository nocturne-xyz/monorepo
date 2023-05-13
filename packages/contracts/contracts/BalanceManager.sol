// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;
pragma abicoder v2;

// Internal
import {ITeller} from "./interfaces/ITeller.sol";
import {CommitmentTreeManager} from "./CommitmentTreeManager.sol";
import {Utils} from "./libs/Utils.sol";
import {AssetUtils} from "./libs/AssetUtils.sol";
import {OperationUtils} from "./libs/OperationUtils.sol";
import "./libs/Types.sol";

/// @title BalanceManager
/// @author Nocturne Labs
/// @notice Module containing logic for funding the Handler contract during operation processing and
///         handling refunds for any remaining assets left in the Handler after operation execution.
contract BalanceManager is CommitmentTreeManager {
    using OperationLib for Operation;

    // Teller contract to send/request assets to/from
    ITeller public _teller;

    // Array of received erc721/1155s, populated by Handler onReceived hooks
    EncodedAsset[] public _receivedAssets;

    // Gap for upgrade safety
    uint256[50] private __GAP;

    /// @notice Internal initializer function
    /// @param teller Address of the teller contract
    /// @param subtreeUpdateVerifier Address of the subtree update verifier contract
    function __BalanceManager_init(
        address teller,
        address subtreeUpdateVerifier
    ) internal onlyInitializing {
        __CommitmentTreeManager_init(subtreeUpdateVerifier);
        _teller = ITeller(teller);
    }

    /// @notice For each joinSplit in op.joinSplits, check root and nullifier validity against
    ///         commitment tree manager, then request joinSplit.publicSpend barring tokens for gas
    ///         payment.
    /// @dev Before looping through joinSplits, we calculate amount of gas to reserve based on
    ///      execution gas, number of joinSplits, and number of refunds. Then we loop through
    ///      joinSplits, check root and nullifier validity, and attempt to reserve as much gas asset
    ///      as possible until we have gotten as the reserve amount we originally calculated. If we
    ///      have not reserved enough gas asset after looping through all joinSplits, we revert.
    /// @param op Operation to process joinSplits for
    /// @param perJoinSplitVerifyGas Gas cost of verifying a single joinSplit proof, calculated by
    ///                              teller during (batch) proof verification
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

            // Default to requesting all publicSpend from teller
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
                // Deduct gas payment from value to transfer to teller
                valueToTransfer -= gasPaymentThisJoinSplit;
                // Deduct gas payment from the amount to be reserved
                gasAssetToReserve -= gasPaymentThisJoinSplit;
            }

            // If value to transfer is 0, skip the transfer
            if (valueToTransfer > 0) {
                _teller.requestAsset(
                    op.joinSplits[i].encodedAsset,
                    valueToTransfer
                );
            }
        }

        require(gasAssetToReserve == 0, "Too few gas tokens");
    }

    /// @notice Gather reserved gas assets and pay bundler calculated amount.
    /// @dev Bundler can be paid less than reserved amount. Reserved amount is refunded to user's
    /// stealth address in this case.
    /// @param op Operation, which contains info on how much gas was reserved
    /// @param opResult OperationResult, which contains info on how much gas was actually spent
    /// @param perJoinSplitVerifyGas Gas cost of verifying a single joinSplit proof
    /// @param bundler Address of the bundler to pay
    function _gatherReservedGasAssetAndPayBundler(
        Operation calldata op,
        OperationResult memory opResult,
        uint256 perJoinSplitVerifyGas,
        address bundler
    ) internal {
        EncodedAsset calldata encodedGasAsset = op.encodedGasAsset;
        uint256 gasAssetAmount = op.maxGasAssetCost(perJoinSplitVerifyGas);

        if (gasAssetAmount > 0) {
            // Request reserved gasAssetAmount from teller.
            /// @dev This is safe because _processJoinSplitsReservingFee is
            /// guaranteed to have reserved gasAssetAmount since it didn't throw.
            _teller.requestAsset(encodedGasAsset, gasAssetAmount);

            uint256 bundlerPayout = OperationUtils
                .calculateBundlerGasAssetPayout(op, opResult);
            AssetUtils.transferAssetTo(encodedGasAsset, bundler, bundlerPayout);
        }
    }

    /// @notice Returns max number of refunds to handle.
    /// @dev The number of refunds actually inserted into commitment tree may be less than this
    ///      number, this is upper bound. This is used by Handler to ensure
    ///      outstanding refunds < op.maxNumRefunds.
    /// @param op Operation to calculate max number of refunds for
    function _totalNumRefundsToHandle(
        Operation calldata op
    ) internal view returns (uint256) {
        return
            op.joinSplits.length +
            op.encodedRefundAssets.length +
            _receivedAssets.length;
    }

    /// @notice Handle all refunds for an operation, potentially sending back any leftover assets
    ///         to the Teller and inserting new note commitments for the sent back assets.
    /// @dev Checks for refunds from joinSplits, op.encodedRefundAssets, any assets received from
    ///      onReceived hooks (erc721/1155s). A refund occurs if any of the checked assets have
    ///      outstanding balance > 0 in the Handler. If a refund occurs, the Handler will transfer
    ///      the asset back to the Teller and insert a new note commitment into the commitment tree.
    /// @param op Operation to handle refunds for
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

    /// @notice Handle a refund for a single asset
    /// @dev Checks if asset has outstanding balance in the Handler. If so, transfers the asset
    ///      back to the Teller and inserts a new note commitment into the commitment tree.
    /// @param encodedAsset Encoded asset to check for refund
    /// @param refundAddr Stealth address to refund to
    function _handleRefundForAsset(
        EncodedAsset memory encodedAsset,
        StealthAddress calldata refundAddr
    ) internal {
        uint256 currentBalance = AssetUtils.balanceOfAsset(encodedAsset);

        // TODO: document prefill logic
        (AssetType assetType, , ) = AssetUtils.decodeAsset(encodedAsset);
        uint256 amountToLeave = assetType == AssetType.ERC20 ? 1 : 0;

        if (currentBalance > amountToLeave) {
            uint256 difference = currentBalance - amountToLeave;
            AssetUtils.transferAssetTo(
                encodedAsset,
                address(_teller),
                difference
            );
            _handleRefundNote(encodedAsset, refundAddr, difference);
        }
    }
}
