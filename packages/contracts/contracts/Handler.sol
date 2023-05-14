//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.17;
pragma abicoder v2;

// External
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {IERC721ReceiverUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721ReceiverUpgradeable.sol";
import {IERC1155ReceiverUpgradeable, IERC165Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC1155/IERC1155ReceiverUpgradeable.sol";
// Internal
import {IHandler} from "./interfaces/IHandler.sol";
import {BalanceManager} from "./BalanceManager.sol";
import {NocturneReentrancyGuard} from "./NocturneReentrancyGuard.sol";
import {Utils} from "./libs/Utils.sol";
import {OperationUtils} from "./libs/OperationUtils.sol";
import {Groth16} from "./libs/Groth16.sol";
import {AssetUtils} from "./libs/AssetUtils.sol";
import "./libs/Types.sol";

contract Handler is
    IHandler,
    IERC721ReceiverUpgradeable,
    IERC1155ReceiverUpgradeable,
    BalanceManager,
    NocturneReentrancyGuard
{
    mapping(address => bool) public _supportedContractAllowlist;

    // gap for upgrade safety
    uint256[50] private __GAP;

    event SupportedContractAllowlistPermissionSet(
        address contractAddress,
        bool permission
    );

    function initialize(
        address teller,
        address subtreeUpdateVerifier
    ) external initializer {
        __NocturneReentrancyGuard_init();
        __BalanceManager_init(teller, subtreeUpdateVerifier);
    }

    modifier onlyThis() {
        require(msg.sender == address(this), "Only this");
        _;
    }

    modifier onlyTeller() {
        require(msg.sender == address(_teller), "Only teller");
        _;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // Gives an handler ability to call function with on the specified protocol
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

    function handleDeposit(
        DepositRequest calldata deposit
    ) external override whenNotPaused onlyTeller {
        (, address assetAddr, ) = AssetUtils.decodeAsset(deposit.encodedAsset);
        require(
            _supportedContractAllowlist[assetAddr],
            "!supported deposit asset"
        );

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
        onlyTeller
        handleOperationGuard
        returns (OperationResult memory opResult)
    {
        require(op.chainId == block.chainid, "invalid chainid");
        require(block.timestamp <= op.deadline, "expired deadline");

        // Ensure refund assets supported
        for (uint256 i = 0; i < op.encodedRefundAssets.length; i++) {
            (, address assetAddr, ) = AssetUtils.decodeAsset(
                op.encodedRefundAssets[i]
            );
            require(
                _supportedContractAllowlist[assetAddr],
                "!supported refund asset"
            );
        }

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
            // Indicates revert because of one of the following reasons:
            // 1. `executeActions` attempted to process more refunds than `maxNumRefunds`
            // 2. `executeActions` exceeded `executionGasLimit`, but in its outer call context (i.e. while not making an external call)
            // 3. `atomicActions = true` and an action failed.

            // we explicitly catch cases 1 and 3 in `executeActions`, so if `executeActions` failed silently,
            // then it must be case 2.
            string memory revertMsg = OperationUtils.getRevertMsg(reason);
            if (bytes(revertMsg).length == 0) {
                opResult.failureReason = "exceeded `executionGasLimit`";
            } else {
                opResult.failureReason = revertMsg;
            }
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
        uint256 numRefundsToHandle = _totalNumRefundsToHandle(op);
        require(op.maxNumRefunds >= numRefundsToHandle, "Too many refunds");
    }

    function onERC721Received(
        address, // operator
        address, // from
        uint256 id,
        bytes calldata // data
    ) external override whenNotPaused returns (bytes4) {
        // Must reject the transfer outside of an operation handling
        uint256 stage = reentrancyGuardStage();
        if (stage == NOT_ENTERED || !_supportedContractAllowlist[msg.sender]) {
            return 0;
        }

        // Record the transfer if it results from executed actions
        if (stage == ENTERED_EXECUTE_ACTIONS) {
            _receivedAssets.push(
                AssetUtils.encodeAsset(AssetType.ERC721, msg.sender, id)
            );
        }

        // ENTERED_PROCESS is ok because this is when teller funds handler
        return IERC721ReceiverUpgradeable.onERC721Received.selector;
    }

    function onERC1155Received(
        address, // operator
        address, // from
        uint256 id,
        uint256, // value
        bytes calldata // data
    ) external override whenNotPaused returns (bytes4) {
        // Reject the transfer outside of an operation handling
        uint256 stage = reentrancyGuardStage();
        if (stage == NOT_ENTERED || !_supportedContractAllowlist[msg.sender]) {
            return 0;
        }

        // Record the transfer if it results from executed actions
        if (stage == ENTERED_EXECUTE_ACTIONS) {
            _receivedAssets.push(
                AssetUtils.encodeAsset(AssetType.ERC1155, msg.sender, id)
            );
        }

        // ENTERED_HANDLE_OPERATION ok
        return IERC1155ReceiverUpgradeable.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address, // operator
        address, // from
        uint256[] calldata ids,
        uint256[] calldata, // values
        bytes calldata // data
    ) external override whenNotPaused returns (bytes4) {
        // Reject the transfer outside of an operation handling
        uint256 stage = reentrancyGuardStage();
        if (stage == NOT_ENTERED || !_supportedContractAllowlist[msg.sender]) {
            return 0;
        }

        // Record the transfer if it results from executed actions
        if (stage == ENTERED_EXECUTE_ACTIONS) {
            uint256 numIds = ids.length;
            for (uint256 i = 0; i < numIds; i++) {
                _receivedAssets.push(
                    AssetUtils.encodeAsset(
                        AssetType.ERC1155,
                        msg.sender,
                        ids[i]
                    )
                );
            }
        }

        // ENTERED_HANDLE_OPERATION ok
        return IERC1155ReceiverUpgradeable.onERC1155BatchReceived.selector;
    }

    function supportsInterface(
        bytes4 interfaceId
    ) external pure override returns (bool) {
        return
            (interfaceId == type(IERC165Upgradeable).interfaceId) ||
            (interfaceId == type(IERC721ReceiverUpgradeable).interfaceId) ||
            (interfaceId == type(IERC1155ReceiverUpgradeable).interfaceId);
    }

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
