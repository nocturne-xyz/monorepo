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
import {WalletUtils} from "./libs/WalletUtils.sol";
import "./libs/types.sol";

contract BalanceManager is
    IERC721Receiver,
    IERC1155Receiver,
    CommitmentTreeManager
{
    using OperationLib for Operation;

    // Constants for operation status
    // Modified from ReentrancyGuard.sol from OpenZeppelin contracts
    uint256 internal constant _NOT_ENTERED = 1;
    uint256 internal constant _ENTERED_PROCESS_OPERATION = 2;
    uint256 internal constant _ENTERED_EXECUTE_OPERATION = 3;

    uint256 public _operation_stage;
    EncodedAsset[] public _receivedAssets;

    IVault public immutable _vault;

    constructor(
        address vault,
        address joinSplitVerifier,
        address _subtreeUpdateVerifier
    ) CommitmentTreeManager(joinSplitVerifier, _subtreeUpdateVerifier) {
        _operation_stage = _NOT_ENTERED;
        _vault = IVault(vault);
    }

    function onERC721Received(
        address, // operator
        address, // from
        uint256 id,
        bytes calldata // data
    ) external override returns (bytes4) {
        // Must reject the NFT transfer outside of an operation
        if (_operation_stage == _NOT_ENTERED) {
            return 0;
        }
        // Record the transfer if it results from executed actions
        if (_operation_stage == _ENTERED_EXECUTE_OPERATION) {
            _receivedAssets.push(
                AssetUtils._encodeAsset(AssetType.ERC721, msg.sender, id)
            );
        }
        // Accept the transfer when _operation_stage != _NOT_ENTERED
        return IERC721Receiver.onERC721Received.selector;
    }

    function onERC1155Received(
        address, // operator
        address, // from
        uint256 id,
        uint256, // value
        bytes calldata // data
    ) external override returns (bytes4) {
        // Must reject the NFT transfer outside of an operation
        if (_operation_stage == _NOT_ENTERED) {
            return 0;
        }
        // Record the transfer if it results from executed actions
        if (_operation_stage == _ENTERED_EXECUTE_OPERATION) {
            _receivedAssets.push(
                AssetUtils._encodeAsset(AssetType.ERC1155, msg.sender, id)
            );
        }
        // Accept the transfer when _operation_stage != _NOT_ENTERED
        return IERC1155Receiver.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address, // operator
        address, // from
        uint256[] calldata ids,
        uint256[] calldata, // values
        bytes calldata // data
    ) external override returns (bytes4) {
        // Must reject the NFT transfer outside of an operation
        if (_operation_stage == _NOT_ENTERED) {
            return 0;
        }
        // Record the transfer if it results from executed actions
        if (_operation_stage == _ENTERED_EXECUTE_OPERATION) {
            uint256 numIds = ids.length;
            for (uint256 i = 0; i < numIds; i++) {
                _receivedAssets.push(
                    AssetUtils._encodeAsset(
                        AssetType.ERC1155,
                        msg.sender,
                        ids[i]
                    )
                );
            }
        }
        // Accept the transfer when _operation_stage != _NOT_ENTERED
        return IERC1155Receiver.onERC1155BatchReceived.selector;
    }

    function supportsInterface(
        bytes4 interfaceId
    ) external pure override returns (bool) {
        return
            (interfaceId == type(IERC165).interfaceId) ||
            (interfaceId == type(IERC721Receiver).interfaceId) ||
            (interfaceId == type(IERC1155Receiver).interfaceId);
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
      vault, while reserving maxGasAssetCost of gasAsset (asset of joinsplitTxs[0])

      @dev If this function returns normally without reverting, then it is safe
      to request maxGasAssetCost from vault with the same encodedAsset as
      joinSplitTxs[0].
    */
    function _processJoinSplitTxsReservingFee(Operation calldata op) internal {
        EncodedAsset calldata encodedGasAsset = op.gasAsset();
        uint256 gasAssetToReserve = op.maxGasAssetCost();

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
                gasAssetToReserve > 0 &&
                AssetUtils._eq(encodedGasAsset, op.joinSplitTxs[i].encodedAsset)
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
                _vault.requestAsset(
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

        // Request reserved gasAssetAmount from vault.
        /// @dev This is safe because _processJoinSplitTxsReservingFee is
        /// guaranteed to have reserved gasAssetAmount since it didn't throw.
        _vault.requestAsset(encodedGasAsset, gasAssetAmount);

        uint256 bundlerPayout = WalletUtils._calculateBundlerGasAssetPayout(
            op,
            opResult
        );
        AssetUtils._transferAssetTo(encodedGasAsset, bundler, bundlerPayout);
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
        uint256 numJoinSplits = op.joinSplitTxs.length;
        for (uint256 i = 0; i < numJoinSplits; ++i) {
            _handleRefundForAsset(
                op.joinSplitTxs[i].encodedAsset,
                op.refundAddr
            );
        }

        uint256 numRefundAssets = op.encodedRefundAssets.length;
        for (uint256 i = 0; i < numRefundAssets; ++i) {
            _handleRefundForAsset(op.encodedRefundAssets[i], op.refundAddr);
        }

        uint256 numReceived = _receivedAssets.length;
        for (uint256 i = 0; i < numReceived; ++i) {
            _handleRefundForAsset(_receivedAssets[i], op.refundAddr);
        }
        delete _receivedAssets;
    }

    function _handleRefundForAsset(
        EncodedAsset memory encodedAsset,
        NocturneAddress memory refundAddr
    ) internal {
        uint256 value = AssetUtils._balanceOfAsset(encodedAsset);
        if (value != 0) {
            AssetUtils._transferAssetTo(encodedAsset, address(_vault), value);
            _handleRefundNote(
                refundAddr,
                encodedAsset.encodedAssetAddr,
                encodedAsset.encodedAssetId,
                value
            );
        }
    }
}
