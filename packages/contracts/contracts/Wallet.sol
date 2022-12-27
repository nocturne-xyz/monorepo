//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.17;
pragma abicoder v2;

import {IWallet} from "./interfaces/IWallet.sol";
import "./interfaces/IVault.sol";
import "./libs/WalletUtils.sol";
import "./libs/types.sol";
import "./BalanceManager.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

import "hardhat/console.sol";

// TODO: use SafeERC20 library
// TODO: make wallet and vault upgradable
contract Wallet is IWallet, BalanceManager {
    uint256 constant GAS_PER_JOINSPLIT = 200000;
    // TODO: add subtree updater fee mechanism
    uint256 constant GAS_PER_REFUND = 0;

    constructor(
        address vault,
        address joinSplitVerifier,
        address subtreeUpdateVerifier
    ) BalanceManager(vault, joinSplitVerifier, subtreeUpdateVerifier) {} // solhint-disable-line no-empty-blocks

    event OperationProcessed(
        uint256 indexed operationDigest,
        bool indexed opProcessed,
        string failureReason,
        bool[] callSuccesses,
        bytes[] callResults
    );

    modifier onlyThis() {
        require(msg.sender == address(this), "Only the Wallet can call this");
        _;
    }

    function depositFunds(Deposit calldata deposit) external override {
        require(deposit.spender == msg.sender, "Spender must be the sender");

        _makeDeposit(deposit);
    }

    function processBundle(
        Bundle calldata bundle
    ) external override returns (OperationResult[] memory) {
        Operation[] calldata ops = bundle.operations;
        uint256[] memory opDigests = WalletUtils.computeOperationDigests(ops);

        (bool success, ) = _verifyAllProofs(ops, opDigests);
        require(success, "Batched JoinSplit verify failed.");

        uint256 numOps = ops.length;
        OperationResult[] memory opResults = new OperationResult[](numOps);
        for (uint256 i = 0; i < numOps; i++) {
            try this.performOperation(ops[i], msg.sender) returns (
                OperationResult memory result
            ) {
                opResults[i] = result;
            } catch (bytes memory reason) {
                opResults[i] = WalletUtils._failOperationWithReason(
                    WalletUtils._getRevertMsg(reason)
                );
            }
            emit OperationProcessed(
                opDigests[i],
                opResults[i].opProcessed,
                opResults[i].failureReason,
                opResults[i].callSuccesses,
                opResults[i].callResults
            );
        }
        return opResults;
    }

    /**
      @dev This function will only be message-called from `processBundle`. It
      will message-call `proformOpeartion`. Outside of the call to
      `performOperation` call, the gas call of this function is bounded.
    */
    function performOperation(
        Operation calldata op,
        address bundler
    ) external onlyThis returns (OperationResult memory opResult) {
        uint256 maxGasFee = WalletUtils.maxGasFee(op);
        // Handle all joinsplit transctions.
        /// @dev This reverts if nullifiers in joinSplitTxs are not fresh
        _handleAllSpends(op.joinSplitTxs, maxGasFee);

        // Execute the encoded actions in a new call context so that reverts
        // are caught explicitly without affecting the call context of this
        // function.
        uint256 gasLeftInitial = gasleft();
        try this.executeActions{gas: op.executionGasLimit}(op.actions) returns (
            OperationResult memory result
        ) {
            opResult = result;
        } catch (bytes memory result) {
            // TODO: properly process this failure case
            opResult = WalletUtils._unsuccessfulOperation(result);
        }
        // Compute executionGasUsed
        opResult.executionGasUsed = gasLeftInitial - gasleft();

        // @dev Revert if number of refund requested is too large
        uint256 numRefunds = op.joinSplitTxs.length + _receivedAssets.length;
        require(numRefunds <= op.maxNumRefunds, "maxNumRefunds is too small.");

        // Gas asset is assumed to be the asset of the first jointSplitTx by convention
        EncodedAsset memory gasAsset = EncodedAsset({
            encodedAssetAddr: op.joinSplitTxs[0].encodedAssetAddr,
            encodedAssetId: op.joinSplitTxs[0].encodedAssetId
        });

        // Request reserved maxGasFee from vault
        // (We can't use _transferAssetFrom because Vault should never allow
        // the Wallet to spend direclty)
        _vault.requestAsset(gasAsset, maxGasFee);

        // Transfer used verification and execution gas to the bundler
        uint256 bundlerPayout = op.gasPrice *
            (opResult.executionGasUsed + WalletUtils.verificationGas(op));
        AssetUtils._transferAssetTo(gasAsset, bundler, bundlerPayout);

        // Process refunds
        _handleAllRefunds(op.joinSplitTxs, op.refundAddr);

        return opResult;
    }

    /**
      @dev This function will only be message-called from
      `performOperationOutter`. The call gas given is the execution gas of the
      operation.
    */
    function executeActions(
        Action[] calldata actions
    ) external onlyThis returns (OperationResult memory opResult) {
        uint256 numActions = actions.length;
        opResult.opProcessed = true; // default to true
        opResult.callSuccesses = new bool[](numActions);
        opResult.callResults = new bytes[](numActions);
        // Sequentially
        for (uint256 i = 0; i < numActions; i++) {
            (bool success, bytes memory result) = _makeExternalCall(actions[i]);

            opResult.callSuccesses[i] = success;
            opResult.callResults[i] = result;
        }
    }

    // Verifies the joinsplit proofs of a bundle of transactions
    // DOES NOT check if nullifiers in each transaction has not been used
    function _verifyAllProofs(
        Operation[] calldata ops,
        uint256[] memory opDigests
    ) internal view returns (bool success, uint256 numJoinSplits) {
        (Groth16.Proof[] memory proofs, uint256[][] memory allPis) = WalletUtils
            .extractJoinSplitProofsAndPis(ops, opDigests);
        success = _joinSplitVerifier.batchVerifyProofs(proofs, allPis);
        return (success, proofs.length);
    }

    function _makeExternalCall(
        Action calldata action
    ) internal returns (bool success, bytes memory result) {
        require(
            action.contractAddress != address(_vault),
            "Cannot call the Nocturne vault"
        );

        (success, result) = action.contractAddress.call(action.encodedFunction);
    }
}
