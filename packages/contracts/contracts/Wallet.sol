//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.17;
pragma abicoder v2;

import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {Versioned} from "./upgrade/Versioned.sol";
import {IWallet} from "./interfaces/IWallet.sol";
import {IVault} from "./interfaces/IVault.sol";
import {Utils} from "./libs/Utils.sol";
import {WalletUtils} from "./libs/WalletUtils.sol";
import {Groth16} from "./libs/WalletUtils.sol";
import {BalanceManager} from "./BalanceManager.sol";
import "./libs/Types.sol";

// TODO: use SafeERC20 library
// TODO: do we need IWallet and IVault? Can probably remove
contract Wallet is
    IWallet,
    BalanceManager,
    ReentrancyGuardUpgradeable,
    OwnableUpgradeable,
    Versioned
{
    using OperationLib for Operation;

    mapping(address => bool) public _depositSources;

    // gap for upgrade safety
    uint256[50] private __GAP;

    event DepositSourcePermissionSet(address source, bool permission);

    event OperationProcessed(
        uint256 indexed operationDigest,
        bool indexed opProcessed,
        string failureReason,
        bool[] callSuccesses,
        bytes[] callResults
    );

    function initialize(
        address vault,
        address joinSplitVerifier,
        address subtreeUpdateVerifier
    ) external initializer {
        __Ownable_init();
        __BalanceManager__init(vault, joinSplitVerifier, subtreeUpdateVerifier);
    }

    modifier onlyThis() {
        require(msg.sender == address(this), "Only wallet");
        _;
    }

    modifier onlyDepositSource() {
        require(_depositSources[msg.sender], "Only deposit source");
        _;
    }

    function setDepositSourcePermission(
        address source,
        bool permission
    ) external onlyOwner {
        _depositSources[source] = permission;
        emit DepositSourcePermissionSet(source, permission);
    }

    function addToAssetPrefill(
        EncodedAsset calldata encodedAsset,
        uint256 value
    ) external onlyOwner {
        _addToAssetPrefill(encodedAsset, value);
    }

    function depositFunds(
        DepositRequest calldata deposit
    ) external override onlyDepositSource {
        _makeDeposit(deposit, msg.sender);
    }

    /**
      Process a bundle of operations.

      @dev The maximum gas cost of a call can be estimated without eth_estimateGas
      1. gas cost of `WalletUtils.computeOperationDigests` and
      `_verifyAllProofsMetered` can be estimated based on length of op.joinSplits
      and overall size of op
      2. maxmimum gas cost of each processOperation can be estimated using op
      (refer to inline docs for `processOperation`)
    */
    function processBundle(
        Bundle calldata bundle
    ) external override nonReentrant returns (OperationResult[] memory) {
        Operation[] calldata ops = bundle.operations;
        uint256[] memory opDigests = WalletUtils.computeOperationDigests(ops);

        (bool success, uint256 perJoinSplitVerifyGas) = _verifyAllProofsMetered(
            ops,
            opDigests
        );

        require(success, "Batched JoinSplit verify failed.");

        uint256 numOps = ops.length;
        OperationResult[] memory opResults = new OperationResult[](numOps);
        for (uint256 i = 0; i < numOps; i++) {
            try
                this.processOperation(ops[i], perJoinSplitVerifyGas, msg.sender)
            returns (OperationResult memory result) {
                opResults[i] = result;
            } catch (bytes memory reason) {
                opResults[i] = WalletUtils.failOperationWithReason(
                    Utils.getRevertMsg(reason)
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
        onlyThis
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

    // Verifies the joinsplit proofs of a bundle of transactions
    // Also returns the gas used to verify per joinsplit
    // DOES NOT check if nullifiers in each transaction has not been used
    function _verifyAllProofsMetered(
        Operation[] calldata ops,
        uint256[] memory opDigests
    ) internal view returns (bool success, uint256 perJoinSplitVerifyGas) {
        uint256 preVerificationGasLeft = gasleft();

        (Groth16.Proof[] memory proofs, uint256[][] memory allPis) = WalletUtils
            .extractJoinSplitProofsAndPis(ops, opDigests);

        // if there is only one proof, use the single proof verification
        if (proofs.length == 1) {
            success = _joinSplitVerifier.verifyProof(proofs[0], allPis[0]);
        } else {
            success = _joinSplitVerifier.batchVerifyProofs(proofs, allPis);
        }

        perJoinSplitVerifyGas =
            (preVerificationGasLeft - gasleft()) /
            proofs.length;
        return (success, perJoinSplitVerifyGas);
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
