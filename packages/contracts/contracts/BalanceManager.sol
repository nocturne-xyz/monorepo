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
    /// @dev We do NOT check that op.encodedAssetsWithLastIndex entries are all unique assets. If
    ///      user has repeated same asset multiple times in op.encodedAssetsWithLastIndex, this
    ///      incurs more gas for user but is not a security concern. Loop will simply perform more
    ///      calls of teller.requestAsset but the end state will be the same.
    /// @dev If user has provided incorrect op.encodedAssetsWithLastIndex (assets do not match
    ///      notes in tree), handleJoinSplits will fail the nullifier checks and revert.
    /// @param op Operation to process joinSplits for
    /// @param perJoinSplitVerifyGas Gas cost of verifying a single joinSplit proof, calculated by
    ///                              teller during (batch) proof verification
    function _processJoinSplitsReservingFee(
        Operation calldata op,
        uint256 perJoinSplitVerifyGas
    ) internal {
        // Ensure all joinsplit roots and nullifiers are valid
        uint256 numAssets = op.encodedAssetsWithLastIndex.length;
        uint previousLastIndex = 0;
        for (uint256 assetIndex = 0; assetIndex < numAssets; assetIndex++) {
            EncodedAssetWithLastIndex memory encodedAssetWithLastIndex = op
                .encodedAssetsWithLastIndex[assetIndex];

            for (
                uint256 i = previousLastIndex;
                i <= encodedAssetWithLastIndex.lastIndex;
                i++
            ) {
                _handleJoinSplit(
                    op.joinSplits[i],
                    encodedAssetWithLastIndex.encodedAsset
                );
            }

            previousLastIndex = encodedAssetWithLastIndex.lastIndex + 1;
        }

        // Get amount of gas asset to reserve, if gasPrice == 0 then user indicated no gas comp for
        // bundler. Gas asset is always first asset in list if gas comp.
        uint256 firstAssetReserveValue = 0;
        if (op.gasPrice > 0) {
            uint256 firstAssetLastJoinSplitIndex = op
                .encodedAssetsWithLastIndex[0]
                .lastIndex;
            uint256 maxGasAssetCost = op.maxGasAssetCost(perJoinSplitVerifyGas);

            require(
                op.totalAssetValueForJoinSplitsInRangeInclusive(
                    0,
                    firstAssetLastJoinSplitIndex
                ) >= maxGasAssetCost,
                "!enough gas asset"
            );
            firstAssetReserveValue = maxGasAssetCost;
        }

        // Gather gas assets from teller to handler
        uint256 startIndex = 0;
        for (uint256 assetIndex = 0; assetIndex < numAssets; assetIndex++) {
            EncodedAssetWithLastIndex memory encodedAssetWithLastIndex = op
                .encodedAssetsWithLastIndex[assetIndex];

            uint256 valueToGather = op
                .totalAssetValueForJoinSplitsInRangeInclusive(
                    startIndex,
                    encodedAssetWithLastIndex.lastIndex
                );

            if (assetIndex == 0 && firstAssetReserveValue > 0) {
                valueToGather -= firstAssetReserveValue;
            }

            startIndex = encodedAssetWithLastIndex.lastIndex + 1;

            _teller.requestAsset(
                encodedAssetWithLastIndex.encodedAsset,
                valueToGather
            );
        }
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
        uint256 gasAssetAmount = op.maxGasAssetCost(perJoinSplitVerifyGas);

        if (gasAssetAmount > 0) {
            // NOTE: we know there is at least one asset since was checked in
            // ensureValidEncodedAssetsWithLastIndex
            EncodedAsset memory encodedGasAsset = op
                .encodedAssetsWithLastIndex[0]
                .encodedAsset;

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
        uint256 numAssets = op.encodedAssetsWithLastIndex.length;
        for (uint256 i = 0; i < numAssets; i++) {
            _handleRefundForAsset(
                op.encodedAssetsWithLastIndex[i].encodedAsset,
                op.refundAddr
            );
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
    /// @dev To prevent clearing the handler's token balances to 0 each time for erc20s, we attempt
    ///      to withold 1 token from the refund each time if the handler's current balance is 0.
    ///      This saves gas for future users because it avoids writing to a zeroed out storage slot
    ///      each time for the handler's balance. This single token can technically be taken by any
    ///      user. The goal is to keep the handler's balance non-zero as often as possible to save
    ///      on user gas.
    /// @param encodedAsset Encoded asset to check for refund
    /// @param refundAddr Stealth address to refund to
    function _handleRefundForAsset(
        EncodedAsset memory encodedAsset,
        StealthAddress calldata refundAddr
    ) internal {
        uint256 currentBalance = AssetUtils.balanceOfAsset(encodedAsset);

        (AssetType assetType, , ) = AssetUtils.decodeAsset(encodedAsset);
        uint256 amountToWithhold = assetType == AssetType.ERC20 ? 1 : 0;

        if (currentBalance > amountToWithhold) {
            uint256 difference = currentBalance - amountToWithhold;
            AssetUtils.transferAssetTo(
                encodedAsset,
                address(_teller),
                difference
            );
            _handleRefundNote(encodedAsset, refundAddr, difference);
        }
    }
}
