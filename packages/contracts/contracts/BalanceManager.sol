// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;
pragma abicoder v2;

// Internal
import {ITeller} from "./interfaces/ITeller.sol";
import {CommitmentTreeManager} from "./CommitmentTreeManager.sol";
import {NocturneReentrancyGuard} from "./NocturneReentrancyGuard.sol";
import {Utils} from "./libs/Utils.sol";
import {AssetUtils} from "./libs/AssetUtils.sol";
import {OperationUtils} from "./libs/OperationUtils.sol";
import "./libs/Types.sol";

contract BalanceManager is CommitmentTreeManager, NocturneReentrancyGuard {
    using OperationLib for Operation;

    ITeller public _teller;

    // erc721/1155s received via safeTransferFrom, populated by Handler received hooks
    EncodedAsset[] public _receivedAssets;

    // Mapping of encoded asset hash => prefilled balance
    mapping(bytes32 => uint256) public _prefilledAssetBalances;

    // gap for upgrade safety
    uint256[50] private __GAP;

    event UpdatedAssetPrefill(EncodedAsset encodedAsset, uint256 balance);

    function __BalanceManager_init(
        address teller,
        address subtreeUpdateVerifier
    ) internal onlyInitializing {
        __NocturneReentrancyGuard_init();
        __CommitmentTreeManager_init(subtreeUpdateVerifier);
        _teller = ITeller(teller);
    }

    modifier notErc721(EncodedAsset calldata encodedAsset) {
        (AssetType assetType, address assetAddr, uint256 id) = AssetUtils
            .decodeAsset(encodedAsset);
        require(assetType != AssetType.ERC721, "not erc721");
        _;
    }

    function _addToAssetPrefill(
        EncodedAsset calldata encodedAsset,
        uint256 value
    ) internal notErc721(encodedAsset) {
        bytes32 assetHash = AssetUtils.hashEncodedAsset(encodedAsset);
        _prefilledAssetBalances[assetHash] += value;

        AssetUtils.transferAssetFrom(encodedAsset, msg.sender, value);
        emit UpdatedAssetPrefill(
            encodedAsset,
            _prefilledAssetBalances[assetHash]
        );
    }

    /**
      Process all joinSplits and request all declared publicSpend from the
      teller, while reserving maxGasAssetCost of gasAsset (asset of joinsplitTxs[0])

      @dev If this function returns normally without reverting, then it is safe
      to request maxGasAssetCost from teller with the same encodedAsset as
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

            // Defaults to requesting all publicSpend from teller
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
      Refund all current teller assets back to refundAddr. The list of assets
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
        bytes32 assetHash = AssetUtils.hashEncodedAsset(encodedAsset);
        uint256 preFilledBalance = _prefilledAssetBalances[assetHash];

        uint256 currentBalance = AssetUtils.balanceOfAsset(encodedAsset);
        if (currentBalance > preFilledBalance) {
            uint256 difference = currentBalance - preFilledBalance;
            AssetUtils.transferAssetTo(
                encodedAsset,
                address(_teller),
                difference
            );
            _handleRefundNote(encodedAsset, refundAddr, difference);
        }
    }
}
