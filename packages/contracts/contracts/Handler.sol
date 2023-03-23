//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.17;
pragma abicoder v2;

import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {Versioned} from "./upgrade/Versioned.sol";
import {IWallet} from "./interfaces/IWallet.sol";
import {IHandler} from "./interfaces/IHandler.sol";
import {Utils} from "./libs/Utils.sol";
import {WalletUtils} from "./libs/WalletUtils.sol";
import {Groth16} from "./libs/WalletUtils.sol";
import {BalanceManager} from "./BalanceManager.sol";
import "./libs/Types.sol";

contract Handler is IHandler, BalanceManager, OwnableUpgradeable {
    function initialize(
        address wallet,
        address subtreeUpdateVerifier
    ) external initializer {
        __BalanceManager_init(wallet, subtreeUpdateVerifier);
    }

    modifier onlyThis() {
        require(msg.sender == address(this), "Only this");
        _;
    }

    modifier onlyWallet() {
        require(msg.sender == address(_wallet), "Only wallet");
        _;
    }

    function handleDeposit(
        DepositRequest calldata deposit
    ) external override onlyWallet {
        StealthAddress calldata depositAddr = deposit.depositAddr;
        _handleRefundNote(depositAddr, deposit.encodedAsset, deposit.value);
    }

    /**
      @dev This function will only be message-called from `processBundle` and
      can only be entered once inside an Evm transaction. It will message-call
      `executeActions`.

      @param op an Operation
      @param bundler address of the bundler that provided the bundle
      @return opResult the result of the operation

      @dev This function can throw due to internal errors or being out-of-gas.
      It is expected of `processBundle` to catch this error.

      @dev The gas cost of the call can be estimated in constant time given op:
      1. The gas cost before `executeActions` can be bounded as a function of
      op.joinSplits.length
      2. `executeActions` uses at most op.executionGasLimit
      3. The gas cost after `executeActions` can be bounded as a function of
      op.maxNumRefunds
      The bundler should estimate the gas cost functions in 1 and 3 offchain.
    */
    function processOperation(
        Operation calldata op,
        uint256 perJoinSplitVerifyGas,
        address bundler
    )
        external
        onlyWallet
        processOperationGuard
        returns (OperationResult memory opResult)
    {
        // Handle all joinsplit transctions.
        /// @dev This reverts if nullifiers in op.joinSplits are not fresh
        _processJoinSplitsReservingFee(op, perJoinSplitVerifyGas);

        uint256 preExecutionGas = gasleft();
        try this.executeActions{gas: op.executionGasLimit}(op) returns (
            OperationResult memory result
        ) {
            opResult = result;
        } catch (bytes memory reason) {
            opResult = WalletUtils.failOperationWithReason(
                Utils.getRevertMsg(reason)
            );
        }

        // Set verification and execution gas after getting opResult
        opResult.verificationGas = WalletUtils.verificationGasForOp(
            op,
            perJoinSplitVerifyGas
        );
        opResult.executionGas = preExecutionGas - gasleft();

        // Gather reserved gas asset and process gas payment to bundler
        _gatherReservedGasAssetAndPayBundler(
            op,
            opResult,
            perJoinSplitVerifyGas,
            bundler
        );

        // Note: if too many refunds condition reverted in execute actions, the
        // actions creating the refunds were reverted too, so numRefunds would =
        // joinsplits.length + encodedRefundAssets.length
        _handleAllRefunds(op);

        return opResult;
    }

    /**
      @dev This function will only be message-called from `processOperation`.
      The call gas given is the execution gas specified by the operation.
    */
    function executeActions(
        Operation calldata op
    )
        external
        onlyThis
        executeActionsGuard
        returns (OperationResult memory opResult)
    {
        uint256 numActions = op.actions.length;
        opResult.opProcessed = true; // default to true
        opResult.callSuccesses = new bool[](numActions);
        opResult.callResults = new bytes[](numActions);

        // Execute each external call
        // TODO: Add sequential call semantic
        for (uint256 i = 0; i < numActions; i++) {
            (bool success, bytes memory result) = _makeExternalCall(
                op.actions[i]
            );

            opResult.callSuccesses[i] = success;
            opResult.callResults[i] = result;
        }

        // Ensure number of refunds didn't exceed max specified in op.
        // If it did, executeActions is reverts and all action state changes
        // are rolled back.
        uint256 numRefundsToHandle = _totalNumRefundsToHandle(op);
        require(op.maxNumRefunds >= numRefundsToHandle, "Too many refunds");

        opResult.numRefunds = numRefundsToHandle;
    }

    function _makeExternalCall(
        Action calldata action
    ) internal returns (bool success, bytes memory result) {
        require(
            action.contractAddress != address(_wallet),
            "Cannot call the Nocturne wallet"
        );

        (success, result) = action.contractAddress.call(action.encodedFunction);
    }
}
