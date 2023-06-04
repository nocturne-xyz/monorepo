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
    /// @dev We attempt to group asset transfers to handler by contiguous subarrays of joinsplits
    ///      for same asset. User can group however they like but contiguous group saves them gas
    ///      by reducing number of teller.requestAsset calls.
    /// @param op Operation to process joinSplits for
    /// @param perJoinSplitVerifyGas Gas cost of verifying a single joinSplit proof, calculated by
    ///                              teller during (batch) proof verification
    function _processJoinSplitsReservingFee(
        Operation calldata op,
        uint256 perJoinSplitVerifyGas
    ) internal {
        // process nullifiers and insert new noteCommitments for each joinSplit
        // will throw an error if nullifiers are invalid or tree root invalid
        _handleJoinSplits(op.joinSplits);

        // Get gas asset and amount to reserve
        EncodedAsset calldata encodedGasAsset = op.encodedGasAsset;
        uint256 gasAssetToReserve = op.maxGasAssetCost(perJoinSplitVerifyGas);

        // Loop through joinSplits and gather assets, reserving gas asset as needed
        uint256 numJoinSplits = op.joinSplits.length;
        for (
            uint256 subarrayStartIndex = 0;
            subarrayStartIndex < numJoinSplits;

        ) {
            EncodedAsset calldata encodedAsset = op
                .joinSplits[subarrayStartIndex]
                .encodedAsset;

            // Get largest possible subarray for current asset and sum of publicSpend
            uint256 subarrayEndIndex = _getHighestContiguousJoinSplitIndex(
                op.joinSplits,
                subarrayStartIndex
            );
            uint256 valueToGatherForSubarray = _sumJoinSplitPublicSpendsInclusive(
                    op.joinSplits,
                    subarrayStartIndex,
                    subarrayEndIndex
                );

            if (
                gasAssetToReserve > 0 &&
                AssetUtils.eq(encodedGasAsset, encodedAsset)
            ) {
                uint256 reserveValue = Utils.min(
                    valueToGatherForSubarray,
                    gasAssetToReserve
                );

                valueToGatherForSubarray -= reserveValue;
                gasAssetToReserve -= reserveValue;
            }

            subarrayStartIndex = subarrayEndIndex + 1;

            // If value to transfer is 0, skip the transfer
            if (valueToGatherForSubarray > 0) {
                _teller.requestAsset(encodedAsset, valueToGatherForSubarray);
            }
        }

        require(gasAssetToReserve == 0, "Too few gas tokens");
    }

    /// @notice Gather reserved gas assets and pay bundler calculated amount.
    /// @dev Bundler can be paid less than reserved amount. Reserved amount is refunded to user's
    /// stealth address in this case.
    /// @dev If the amount of gas asset remaining after bundler payout is less than the operation's
    ///      gasAssetRefundThreshold, we just give the remaining amount to bundler. This is because
    ///      the cost of handling refund for dust note and later proving ownership of the dust note
    ///      will outweigh the actual value of the note.
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
        uint256 gasAssetReserved = op.maxGasAssetCost(perJoinSplitVerifyGas);

        if (gasAssetReserved > 0) {
            // Request reserved gasAssetReserved from teller.
            /// @dev This is safe because _processJoinSplitsReservingFee is
            /// guaranteed to have reserved gasAssetReserved since it didn't throw.
            _teller.requestAsset(encodedGasAsset, gasAssetReserved);

            uint256 bundlerPayout = OperationUtils
                .calculateBundlerGasAssetPayout(op, opResult);
            if (gasAssetReserved - bundlerPayout < op.gasAssetRefundThreshold) {
                bundlerPayout = gasAssetReserved; // Give all to bundler if under threshold
            }

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
        for (
            uint256 subarrayStartIndex = 0;
            subarrayStartIndex < numJoinSplits;

        ) {
            uint256 subarrayEndIndex = _getHighestContiguousJoinSplitIndex(
                op.joinSplits,
                subarrayStartIndex
            );
            _handleRefundForAsset(
                op.joinSplits[subarrayStartIndex].encodedAsset,
                op.refundAddr
            );
            subarrayStartIndex = subarrayEndIndex + 1;
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
        CompressedStealthAddress calldata refundAddr
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

    /// @notice Get highest index for contiguous subarray of joinsplits of same encodedAssetType
    /// @dev Used so we can take sum(subarray) make single call teller.requestAsset(asset, sum)
    ///      instead of calling teller.requestAsset multiple times for the same asset
    /// @param joinSplits op.joinSplits
    /// @param startIndex Index to start searching from
    function _getHighestContiguousJoinSplitIndex(
        JoinSplit[] calldata joinSplits,
        uint256 startIndex
    ) private pure returns (uint256) {
        EncodedAsset calldata startAsset = joinSplits[startIndex].encodedAsset;
        uint256 numJoinSplits = joinSplits.length;

        uint256 highestIndex = startIndex;
        while (
            highestIndex + 1 < numJoinSplits &&
            AssetUtils.eq(startAsset, joinSplits[highestIndex + 1].encodedAsset)
        ) {
            highestIndex++;
        }

        return highestIndex;
    }

    /// @notice Get sum of public spends for a contiguous subarray of joinsplits
    /// @param joinSplits op joinSplits
    /// @param startIndex Index to start summing from
    /// @param endIndex Index to end summing at (inclusive)
    function _sumJoinSplitPublicSpendsInclusive(
        JoinSplit[] calldata joinSplits,
        uint256 startIndex,
        uint256 endIndex
    ) private pure returns (uint256) {
        uint256 sum = 0;
        for (uint256 i = startIndex; i <= endIndex; i++) {
            sum += joinSplits[i].publicSpend;
        }
        return sum;
    }
}
