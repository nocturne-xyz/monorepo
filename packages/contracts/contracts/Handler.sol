//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.17;
pragma abicoder v2;

// Internal
import {IHandler} from "./interfaces/IHandler.sol";
import {BalanceManager} from "./BalanceManager.sol";
import {NocturneReentrancyGuard} from "./NocturneReentrancyGuard.sol";
import {Utils} from "./libs/Utils.sol";
import {OperationUtils} from "./libs/OperationUtils.sol";
import {Groth16} from "./libs/Groth16.sol";
import {AssetUtils} from "./libs/AssetUtils.sol";
import "./libs/Types.sol";

/// @title Handler
/// @author Nocturne Labs
/// @notice Handler contract for processing and executing operations.
contract Handler is IHandler, BalanceManager, NocturneReentrancyGuard {
    using OperationLib for Operation;

    // Set of callable protocols and tokens
    mapping(address => bool) public _supportedContractAllowlist;

    // Gap for upgrade safety
    uint256[50] private __GAP;

    /// @notice Event emitted when a contract is given/revoked allowlist permission
    event SupportedContractAllowlistPermissionSet(
        address contractAddress,
        bool permission
    );

    /// @notice Initialization function
    /// @param teller Address of the Teller contract
    /// @param subtreeUpdateVerifier Address of the subtree update verifier contract
    function initialize(
        address teller,
        address subtreeUpdateVerifier
    ) external initializer {
        __NocturneReentrancyGuard_init();
        __BalanceManager_init(teller, subtreeUpdateVerifier);
    }

    /// @notice Only callable by the handler itself (used so handler can message call itself)
    modifier onlyThis() {
        require(msg.sender == address(this), "Only this");
        _;
    }

    /// @notice Only callable by the Teller contract
    modifier onlyTeller() {
        require(msg.sender == address(_teller), "Only teller");
        _;
    }

    /// @notice Pauses the contract, only callable by owner
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Unpauses the contract, only callable by owner
    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Sets allowlist permission of the given contract, only callable by owner
    /// @param contractAddress Address of the contract to add
    /// @param permission Whether to enable or revoke permission
    function setSupportedContractAllowlistPermission(
        address contractAddress,
        bool permission
    ) external onlyOwner {
        _supportedContractAllowlist[contractAddress] = permission;
        emit SupportedContractAllowlistPermissionSet(
            contractAddress,
            permission
        );
    }

    /// @notice Handles deposit call from Teller. Inserts new note commitment for deposit.
    /// @dev This method is only callable by the Teller contract when contract is not paused.
    /// @dev Function checks asset is on the allowlist to avoid unsupported tokens getting stuck.
    /// @param deposit Deposit to handle
    function handleDeposit(
        Deposit calldata deposit
    ) external override whenNotPaused onlyTeller {
        EncodedAsset memory encodedAsset = deposit.encodedAsset;
        (, address assetAddr, ) = AssetUtils.decodeAsset(encodedAsset);
        require(
            _supportedContractAllowlist[assetAddr],
            "!supported deposit asset"
        );

        _handleRefundNote(encodedAsset, deposit.depositAddr, deposit.value);
    }

    /// @notice Handles an operation after proofs have been verified by the Teller. Checks
    ///         joinSplits, requests proven funds from the Teller, executes op.actions, compensates
    ///         the bundler, then handles refunds.
    /// @dev This method is only callable by the Teller contract when contract is not paused.
    /// @dev There are 3 call nested call contexts used to isolate different types of errors:
    ///         1. handleOperation: A revert here means the bundler failed to perform standard
    ///            checks that are predictable (e.g. valid chainid, valid deadline, enough gas
    ///            assets, etc). The bundler is not compensated when reverts happen here because
    ///            the revert happens before _gatherReservedGasAssetAndPayBundler is called.
    ///         2. executeActions: A revert here can be due to unpredictable reasons, mainly if
    ///            there is not enough executionGas for the actions or if the call produces more
    ///            refunds than op.maxNumRefunds (neither can be predictably simulated by bundler).
    ///         3. _makeExternalCall: A revert here only leads to a revert if
    ///           op.atomicActions = true (requires all actions to succeed atomically or none at
    ///           all).
    /// @dev The gas usage of an operation can be given an upper bound estimate as a function of
    ///      op.joinSplits.length, op.executionGasLimit, and op.maxNumRefunds. Note that the user
    ///      must specify executionGasLimit and maxNumRefunds to give an upper bound on gas usage
    ///      because these are "hard to simulate" values that the bundler cannot predict.
    /// @param op Operation to handle
    /// @param perJoinSplitVerifyGas Gas usage for verifying a single joinSplit proof
    /// @param bundler Address of the bundler
    function handleOperation(
        Operation calldata op,
        uint256 perJoinSplitVerifyGas,
        address bundler
    )
        external
        whenNotPaused
        onlyTeller
        handleOperationGuard
        returns (OperationResult memory opResult)
    {
        require(op.chainId == block.chainid, "invalid chainid");
        require(block.timestamp <= op.deadline, "expired deadline");

        // Ensure refund assets supported
        uint256 numRefundAssets = op.encodedRefundAssets.length;
        for (uint256 i = 0; i < numRefundAssets; i++) {
            (, address assetAddr, ) = AssetUtils.decodeAsset(
                op.encodedRefundAssets[i]
            );
            require(
                _supportedContractAllowlist[assetAddr],
                "!supported refund asset"
            );
        }

        // Handle all joinsplits
        _processJoinSplitsReservingFee(op, perJoinSplitVerifyGas);

        // If reached this point, assets have been unwrapped and will have refunds to handle
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
            // Indicates revert because of one of the following reasons:
            // 1. `executeActions` attempted to process more refunds than `maxNumRefunds`
            // 2. `executeActions` exceeded `executionGasLimit`, but in its outer call context
            //    (i.e. while not making an external call)
            // 3. There was a revert when executing actions (e.g. atomic actions, unsupported
            //    contract call, etc)

            // We explicitly catch cases 1 and 3 in `executeActions`, so if `executeActions` failed
            // silently, then it must be case 2.
            string memory revertMsg = OperationUtils.getRevertMsg(reason);
            if (bytes(revertMsg).length == 0) {
                opResult.failureReason = "exceeded `executionGasLimit`";
            } else {
                opResult.failureReason = revertMsg;
            }
        }

        // Set verification and execution gas after getting opResult
        opResult.verificationGas = perJoinSplitVerifyGas * op.joinSplits.length;
        opResult.executionGas = Utils.min(
            op.executionGasLimit,
            preExecutionGas - gasleft()
        );
        opResult.numRefunds = op.totalNumRefundsToHandle();

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

    /// @notice Executes an array of actions for an operation.
    /// @dev This function is only callable by the Handler itself when not paused.
    /// @dev This function can revert if any of the below occur (revert not within action itself):
    ///         1. The call runs out of gas in the outer call context (OOG)
    ///         2. The executed action results in more refunds than maxNumRefunds
    ///         3. An action reverts and atomicActions is set to true
    ///         4. A call to an unsupported protocol is attempted
    ///         5. An action attempts to re-enter by calling the Teller contract
    /// @param op Operation to execute actions for
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
                string memory revertMsg = OperationUtils.getRevertMsg(
                    results[i]
                );
                if (bytes(revertMsg).length == 0) {
                    // TODO maybe say which action?
                    revert("action silently reverted");
                } else {
                    revert(revertMsg);
                }
            }
        }

        // Ensure number of refunds didn't exceed max specified in op.
        // If it did, executeActions is reverts and all action state changes
        // are rolled back.
        uint256 numRefundsToHandle = op.totalNumRefundsToHandle();
        require(op.maxNumRefunds >= numRefundsToHandle, "Too many refunds");
    }

    /// @notice Makes an external call to execute a single action
    /// @dev Reverts if caller attempts to call unsupported contract OR if caller tries
    ///      to re-enter by calling the Teller contract.
    function _makeExternalCall(
        Action calldata action
    ) internal returns (bool success, bytes memory result) {
        require(
            action.contractAddress != address(_teller),
            "Cannot call the Nocturne Teller"
        );
        require(
            _supportedContractAllowlist[action.contractAddress],
            "Cannot call non-allowed protocol"
        );

        (success, result) = action.contractAddress.call(action.encodedFunction);
    }
}
