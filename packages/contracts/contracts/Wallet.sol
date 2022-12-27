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
            try this.performOperationOutter(ops[i], msg.sender) returns (
                OperationResult memory result
            ) {
                opResults[i] = result;
            } catch (bytes memory reason) {
                opResults[i] = WalletUtils._failOperationWithReason(WalletUtils._getRevertMsg(reason));
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
    function performOperationOutter(
        Operation calldata op,
        address bundler
    ) external onlyThis returns (OperationResult memory opResult) {
        uint256 maxGasFee = op.gasLimit * op.gasPrice;
        _handleAllSpends(op.joinSplitTxs, maxGasFee);
        // First compute execution gas for this operation
        uint256 verificationGas = op.joinSplitTxs.length * GAS_PER_JOINSPLIT;
        uint256 maxRefundGas = op.maxNumRefunds * GAS_PER_REFUND;
        uint256 gasToReserve = verificationGas + maxRefundGas;
        // Not enough executionGas, operation fails
        if (gasToReserve >= op.gasLimit) {
            opResult = WalletUtils._failOperationWithReason("Not enough execution gas.");
        } else {
            uint256 executionGas = op.gasLimit - gasToReserve;
            try this.performOperation{gas: executionGas}(op) returns (
                OperationResult memory result
            ) {
                opResult = result;
            } catch (bytes memory reason) {
                opResult = WalletUtils._failOperationWithReason(WalletUtils._getRevertMsg(reason));
            }
        }

        EncodedAsset memory gasAsset = EncodedAsset({
            encodedAddr: op.joinSplitTxs[0].encodedAddr,
            encodedId: op.joinSplitTxs[0].encodedId
        });

        // Request reserved maxGasFee minus subtree updater fee from vault
        _vault.requestAsset(
            gasAsset,
            maxGasFee - opResult.refundGasUsed * op.gasPrice
        );

        // Transfer used verification and execution gas to the bundler
        uint256 bundlerPayout = op.gasPrice *
            (opResult.executionGasUsed +
                GAS_PER_JOINSPLIT *
                op.joinSplitTxs.length);
        AssetUtils._transferAssetTo(gasAsset, bundler, bundlerPayout);

        // Revert if number of refunds is too large
        uint256 numRefunds = op.joinSplitTxs.length + _receivedTokens.length;
        require(numRefunds <= op.maxNumRefunds, "maxNumRefunds is too small.");

        // Process refunds
        _handleAllRefunds(op.joinSplitTxs, op.refundAddr);
    }

    /**
      @dev This function will only be message-called from
      `performOperationOutter`. The call gas given is the execution gas of the
      operation.
    */
    function performOperation(
        Operation calldata op
    ) external onlyThis returns (OperationResult memory opResult) {
        uint256 gasLeftInitial = gasleft();

        Action[] calldata actions = op.actions;
        uint256 numActions = actions.length;
        opResult.opProcessed = true; // default to true
        opResult.callSuccesses = new bool[](numActions);
        opResult.callResults = new bytes[](numActions);
        for (uint256 i = 0; i < numActions; i++) {
            (bool success, bytes memory result) = _makeExternalCall(actions[i]);

            opResult.callSuccesses[i] = success;
            opResult.callResults[i] = result;
        }

        // Compute executionGasUsed
        opResult.executionGasUsed = gasLeftInitial - gasleft();
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
