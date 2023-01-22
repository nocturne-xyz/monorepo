//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.17;
pragma abicoder v2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

import {IWallet} from "./interfaces/IWallet.sol";
import {IJoinSplitVerifier} from "./interfaces/IJoinSplitVerifier.sol";
import "./interfaces/IAccountant.sol";
import "./libs/WalletUtils.sol";
import "./libs/types.sol";
import "./BalanceManager.sol";
import "./upgrade/Versioned.sol";

// TODO: use SafeERC20 library
contract Wallet is IWallet, BalanceManager, Versioned {
    using OperationLib for Operation;

    IJoinSplitVerifier public _joinSplitVerifier;

    // gap for upgrade safety
    uint256[50] private __GAP;

    function initialize(
        address accountant,
        address joinSplitVerifier
    ) external initializer {
        __BalanceManager__init(accountant);

        _joinSplitVerifier = IJoinSplitVerifier(joinSplitVerifier);
    }

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

        _accountant.makeDeposit(deposit);
    }

    /**
      Process a bundle of operations.

      @dev The maximum gas cost of a call can be estimated without eth_estimateGas
      1. gas cost of `WalletUtils.computeOperationDigests` and
      `_verifyAllProofsMetered` can be estimated based on length of op.joinSplitTxs
      and overall size of op
      2. maxmimum gas cost of each processOperation can be estimated using op
      (refer to inline docs for `processOperation`)
    */
    function processBundle(
        Bundle calldata bundle
    ) external override returns (OperationResult[] memory) {
        Operation[] calldata ops = bundle.operations;
        uint256[] memory opDigests = WalletUtils.computeOperationDigests(ops);

        (bool success, uint256 perJoinSplitGas) = _verifyAllProofsMetered(
            ops,
            opDigests
        );

        require(success, "Batched JoinSplit verify failed.");

        uint256 numOps = ops.length;
        OperationResult[] memory opResults = new OperationResult[](numOps);
        for (uint256 i = 0; i < numOps; i++) {
            uint256 verificationGasForOp = WalletUtils._verificationGasForOp(
                ops[i],
                perJoinSplitGas
            );

            try
                this.processOperation(ops[i], verificationGasForOp, msg.sender)
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
      `executeOperation`.

      @param op an Operation
      @param bundler address of the bundler that provided the bundle
      @return opResult the result of the operation

      @dev This function can throw due to internal errors or being out-of-gas.
      It is expected of `processBundle` to catch this error.

      @dev The gas cost of the call can be estimated in constant time given op:
      1. The gas cost before `executeOperation` can be bounded as a function of
      op.joinSplitTxs.length
      2. `executeOperation` uses at most op.executionGasLimit
      3. The gas cost after `executeOperation` can be bounded as a function of
      op.maxNumRefunds
      The bundler should estimate the gas cost functions in 1 and 3 offchain.
    */
    function processOperation(
        Operation calldata op,
        uint256 verificationGasForOp,
        address bundler
    )
        external
        onlyThis
        processOperationGuard
        returns (OperationResult memory opResult)
    {
        // Handle all joinsplit transctions.
        /// @dev This reverts if nullifiers in op.joinSplitTxs are not fresh
        _processJoinSplitTxsReservingFee(op);

        try this.executeOperation{gas: op.executionGasLimit}(op) returns (
            OperationResult memory result
        ) {
            opResult = result;
        } catch (bytes memory result) {
            // TODO: properly process this failure case
            // TODO: properly set opResult.executionGas
            opResult = WalletUtils._unsuccessfulOperation(op, result);
        }
        opResult.verificationGas = verificationGasForOp;

        // Gather reserved gas asset and process gas payment to bundler
        _gatherReservedGasAssetAndPayBundler(op, opResult, bundler);

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
    function executeOperation(
        Operation calldata op
    )
        external
        onlyThis
        executeOperationGuard
        returns (OperationResult memory opResult)
    {
        uint256 preExecutionGas = gasleft();

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
        // If it did, executeOperation is reverts and all action state changes
        // are rolled back.
        uint256 numRefundsToHandle = _totalNumRefundsToHandle(op);
        require(op.maxNumRefunds >= numRefundsToHandle, "Too many refunds");

        opResult.numRefunds = numRefundsToHandle;

        opResult.executionGas = preExecutionGas - gasleft();
    }

    function _payBundlerGasAsset(
        Operation calldata op,
        OperationResult memory opResult,
        address bundler
    ) internal {
        uint256 bundlerPayout = WalletUtils._calculateBundlerGasAssetPayout(
            op,
            opResult
        );
        AssetUtils._transferAssetTo(op.gasAsset(), bundler, bundlerPayout);
    }

    // Verifies the joinsplit proofs of a bundle of transactions
    // Also returns the gas used to verify per joinsplit
    // DOES NOT check if nullifiers in each transaction has not been used
    function _verifyAllProofsMetered(
        Operation[] calldata ops,
        uint256[] memory opDigests
    ) internal view returns (bool success, uint256 perJoinSplitGas) {
        uint256 preVerificationGasLeft = gasleft();

        (Groth16.Proof[] memory proofs, uint256[][] memory allPis) = WalletUtils
            .extractJoinSplitProofsAndPis(ops, opDigests);
        success = _joinSplitVerifier.batchVerifyProofs(proofs, allPis);

        perJoinSplitGas = (preVerificationGasLeft - gasleft()) / proofs.length;
        return (success, perJoinSplitGas);
    }

    function _makeExternalCall(
        Action calldata action
    ) internal returns (bool success, bytes memory result) {
        require(
            action.contractAddress != address(_accountant),
            "Cannot call the accountant"
        );

        (success, result) = action.contractAddress.call(action.encodedFunction);
    }
}
