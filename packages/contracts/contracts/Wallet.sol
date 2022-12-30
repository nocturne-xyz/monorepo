//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.17;
pragma abicoder v2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import {IWallet} from "./interfaces/IWallet.sol";
import "./interfaces/IVault.sol";
import "./libs/WalletUtils.sol";
import "./libs/types.sol";
import "./BalanceManager.sol";

import "hardhat/console.sol";

// TODO: use SafeERC20 library
// TODO: make wallet and vault upgradable
contract Wallet is IWallet, ReentrancyGuard, BalanceManager {
    using OperationLib for Operation;
    using BundleLib for Bundle;

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

    /**
      Process a bundle of operations.

      @dev The maximum gas cost of a call can be estimated without eth_estimateGas
      1. gas cost of `WalletUtils.computeOperationDigests` and
      `_verifyAllProofs` can be estimated based on length of op.joinSplitTxs
      and overall size of op
      2. maxmimum gas cost of each performOperation can be estimated using op
      (refer to inline docs for `performOperation`)
    */
    function processBundle(
        Bundle calldata bundle
    ) external override returns (OperationResult[] memory) {
        uint256 preVerificationGasLeft = gasleft();
        Operation[] calldata ops = bundle.operations;
        uint256[] memory opDigests = WalletUtils.computeOperationDigests(ops);

        require(
            _verifyAllProofs(ops, opDigests),
            "Batched JoinSplit verify failed."
        );
        uint256 totalVerificationGasUsed = preVerificationGasLeft - gasleft();

        uint256 numOps = ops.length;
        OperationResult[] memory opResults = new OperationResult[](numOps);
        for (uint256 i = 0; i < numOps; i++) {
            uint256 verificationGasForOp = WalletUtils.verificationGasForOp(
                bundle,
                i,
                totalVerificationGasUsed
            );

            try
                this.performOperation(ops[i], verificationGasForOp, msg.sender)
            returns (OperationResult memory result) {
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
      @dev This function will only be message-called from `processBundle` and
      can only be entered once inside an Evm transaction. It will message-call
      `executeActions`.

      @param op an Operation
      @param bundler address of the bundler that provided the bundle
      @return opResult the result of the operation

      @dev This function can throw due to internal erros or being out-of-gas.
      It is expected of `processBundle` to catch this error.

      @dev The gas cost of the call can be estimated in constant time given op:
      1. The gas cost before `executeActions` can be bounded as a function of
      op.joinSplitTxs.length
      2. `executeActions` uses at most op.executionGasLimit
      3. The gas cost after `executeActions` can be bounded as a function of
      op.maxNumRefunds
      The bundler should estimate the gas cost functions in 1 and 3 offchain.
    */
    function performOperation(
        Operation calldata op,
        uint256 verificationGasForOp,
        address bundler
    ) external onlyThis nonReentrant returns (OperationResult memory opResult) {
        // Handle all joinsplit transctions.
        /// @dev This reverts if nullifiers in op.joinSplitTxs are not fresh
        _processJoinSplitTxsReservingFee(op);

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

        // Process gas payment to bundler
        _handleGasPayment(
            op,
            opResult.executionGasUsed,
            verificationGasForOp,
            bundler
        );

        // Process refunds
        _handleAllRefunds(op);

        return opResult;
    }

    /**
      @dev This function will only be message-called from `performOperation`.
      The call gas given is the execution gas specified by the operation.
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
    ) internal view returns (bool success) {
        (Groth16.Proof[] memory proofs, uint256[][] memory allPis) = WalletUtils
            .extractJoinSplitProofsAndPis(ops, opDigests);
        success = _joinSplitVerifier.batchVerifyProofs(proofs, allPis);
        return success;
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
