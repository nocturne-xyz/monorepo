//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.17;
pragma abicoder v2;

// External
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
// Internal
import {IHandler} from "./interfaces/IHandler.sol";
import {Utils} from "./libs/Utils.sol";
import {OperationUtils} from "./libs/OperationUtils.sol";
import {Groth16} from "./libs/Groth16.sol";
import {BalanceManager} from "./BalanceManager.sol";
import "./libs/Types.sol";

contract Handler is IHandler, BalanceManager, OwnableUpgradeable {
    mapping(address => bool) public _subtreeBatchFiller;

    mapping(address => mapping(bytes4 => bool))
        public _callableContractAllowlist;

    // gap for upgrade safety
    uint256[50] private __GAP;

    event SubtreeBatchFillerPermissionSet(address filler, bool permission);

    event CallableContractAllowlistPermissionSet(
        address contractAddress,
        bytes4 selector,
        bool permission
    );

    function initialize(
        address wallet,
        address subtreeUpdateVerifier
    ) external initializer {
        __Ownable_init();
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

    modifier onlySubtreeBatchFiller() {
        require(_subtreeBatchFiller[msg.sender], "Only subtree batch filler");
        _;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // Gives an address permission to call `fillBatchesWithZeros`
    function setSubtreeBatchFillerPermission(
        address filler,
        bool permission
    ) external onlyOwner {
        _subtreeBatchFiller[filler] = permission;
        emit SubtreeBatchFillerPermissionSet(filler, permission);
    }

    // Gives an handler ability to call function with given selector on the
    // specified protocol
    function setCallableContractAllowlistPermission(
        address contractAddress,
        bytes4 selector,
        bool permission
    ) external onlyOwner {
        _callableContractAllowlist[contractAddress][selector] = permission;
        emit CallableContractAllowlistPermissionSet(
            contractAddress,
            selector,
            permission
        );
    }

    function addToAssetPrefill(
        EncodedAsset calldata encodedAsset,
        uint256 value
    ) external onlyOwner addToAssetPrefillGuard {
        _addToAssetPrefill(encodedAsset, value);
    }

    function fillBatchWithZeros() external onlySubtreeBatchFiller {
        _fillBatchWithZeros();
    }

    function handleDeposit(
        DepositRequest calldata deposit
    ) external override whenNotPaused onlyWallet {
        StealthAddress calldata depositAddr = deposit.depositAddr;
        _handleRefundNote(deposit.encodedAsset, depositAddr, deposit.value);
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
    function handleOperation(
        Operation calldata op,
        uint256 perJoinSplitVerifyGas,
        address bundler
    )
        external
        whenNotPaused
        onlyWallet
        handleOperationGuard
        returns (OperationResult memory opResult)
    {
        require(op.chainId == block.chainid, "invalid chainid");
        require(block.timestamp <= op.deadline, "expired deadline");

        // Handle all joinsplit transctions.
        /// @dev This reverts if nullifiers in op.joinSplits are not fresh
        _processJoinSplitsReservingFee(op, perJoinSplitVerifyGas);

        // If reached this point, assets have been unwrapped and will have
        // refunds to handle
        opResult.assetsUnwrapped = true;

        uint256 preExecutionGas = gasleft();
        try this.executeActions{gas: op.executionGasLimit}(op) returns (
            bool[] memory successes,
            bytes[] memory results
        ) {
            opResult.opProcessed = true;
            opResult.callSuccesses = successes;
            opResult.callResults = results;
        } catch (bytes memory reason) {
            // Indicates revert because of too many refunds or because
            // atomicActions = true and an action failed. Bundler is compensated
            // and we bubble up failureReason, verificationGas, executionGas,
            // and numRefunds.
            opResult.failureReason = Utils.getRevertMsg(reason);
        }

        // Set verification and execution gas after getting opResult
        opResult.verificationGas = perJoinSplitVerifyGas * op.joinSplits.length;
        opResult.executionGas = preExecutionGas - gasleft();
        opResult.numRefunds = _totalNumRefundsToHandle(op);

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
      @dev This function will only be message-called from `handleOperation`.
      The call gas given is the execution gas specified by the operation.
    */
    function executeActions(
        Operation calldata op
    )
        external
        whenNotPaused
        onlyThis
        executeActionsGuard
        returns (bool[] memory successes, bytes[] memory results)
    {
        uint256 numActions = op.actions.length;
        successes = new bool[](numActions);
        results = new bytes[](numActions);

        // Execute each external call
        for (uint256 i = 0; i < numActions; i++) {
            (successes[i], results[i]) = _makeExternalCall(op.actions[i]);
            if (op.atomicActions && !successes[i]) {
                revert(Utils.getRevertMsg(results[i]));
            }
        }

        // Ensure number of refunds didn't exceed max specified in op.
        // If it did, executeActions is reverts and all action state changes
        // are rolled back.
        uint256 numRefundsToHandle = _totalNumRefundsToHandle(op);
        require(op.maxNumRefunds >= numRefundsToHandle, "Too many refunds");
    }

    function _makeExternalCall(
        Action calldata action
    ) internal returns (bool success, bytes memory result) {
        require(
            action.contractAddress != address(_wallet),
            "Cannot call the Nocturne wallet"
        );

        bytes4 selector = _extractFunctionSelector(action.encodedFunction);
        require(
            _callableContractAllowlist[action.contractAddress][selector],
            "Cannot call non-allowed protocol"
        );

        (success, result) = action.contractAddress.call(action.encodedFunction);
    }

    function _extractFunctionSelector(
        bytes calldata encodedFunctionData
    ) public pure returns (bytes4 selector) {
        require(encodedFunctionData.length >= 4, "Invalid encoded fn length");
        return bytes4(encodedFunctionData[:4]);
    }
}
