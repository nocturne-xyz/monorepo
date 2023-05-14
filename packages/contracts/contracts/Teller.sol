//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.17;
pragma abicoder v2;

// External
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {Versioned} from "./upgrade/Versioned.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {IERC721ReceiverUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721ReceiverUpgradeable.sol";
import {IERC1155ReceiverUpgradeable, IERC165Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC1155/IERC1155ReceiverUpgradeable.sol";
// Internal
import {ITeller} from "./interfaces/ITeller.sol";
import {IHandler} from "./interfaces/IHandler.sol";
import {IJoinSplitVerifier} from "./interfaces/IJoinSplitVerifier.sol";
import {Utils} from "./libs/Utils.sol";
import {AssetUtils} from "./libs/AssetUtils.sol";
import {OperationUtils} from "./libs/OperationUtils.sol";
import {Groth16} from "./libs/OperationUtils.sol";
import "./libs/Types.sol";

/// @title Teller
/// @author Nocturne Labs
/// @notice Teller stores deposited funds and serves as the entry point contract for operations.
contract Teller is
    ITeller,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable,
    OwnableUpgradeable,
    IERC721ReceiverUpgradeable,
    IERC1155ReceiverUpgradeable,
    Versioned
{
    using OperationLib for Operation;

    // Handler contract
    IHandler public _handler;

    // JoinSplit verifier contract
    IJoinSplitVerifier public _joinSplitVerifier;

    // Set of contracts which can deposit funds into Teller
    mapping(address => bool) public _depositSources;

    // Gap for upgrade safety
    uint256[50] private __GAP;

    /// @notice Event emitted when a deposit source is given/revoked permission
    event DepositSourcePermissionSet(address source, bool permission);

    /// @notice Event emitted when an operation is processed/executed (one per operation)
    event OperationProcessed(
        uint256 indexed operationDigest,
        bool indexed opProcessed,
        bool indexed assetsUnwrapped,
        string failureReason,
        bool[] callSuccesses,
        bytes[] callResults
    );

    /// @notice Initializer function
    /// @param handler Address of the handler contract
    /// @param joinSplitVerifier Address of the joinsplit verifier contract
    function initialize(
        address handler,
        address joinSplitVerifier
    ) external initializer {
        __Ownable_init();
        __Pausable_init();
        _handler = IHandler(handler);
        _joinSplitVerifier = IJoinSplitVerifier(joinSplitVerifier);
    }

    /// @notice Only callable by the Handler, so Handler can request assets
    modifier onlyHandler() {
        require(msg.sender == address(_handler), "Only handler");
        _;
    }

    /// @notice Only callable by allowed deposit source
    modifier onlyDepositSource() {
        require(_depositSources[msg.sender], "Only deposit source");
        _;
    }

    /// @notice Pauses contract, only callable by owner
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Unpauses contract, only callable by owner
    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Sets permission for a deposit source
    /// @param source Address of the contract or EOA
    /// @param permission Whether or not the source is allowed to deposit funds
    function setDepositSourcePermission(
        address source,
        bool permission
    ) external onlyOwner {
        _depositSources[source] = permission;
        emit DepositSourcePermissionSet(source, permission);
    }

    /// @notice Deposits funds into the Teller contract and calls on handler to add new notes
    /// @dev Only callable by allowed deposit source when not paused
    /// @param deposit Deposit
    function depositFunds(
        Deposit calldata deposit
    ) external override whenNotPaused onlyDepositSource {
        _handler.handleDeposit(deposit);
        AssetUtils.transferAssetFrom(
            deposit.encodedAsset,
            msg.sender,
            deposit.value
        );
    }

    /// @notice Sends assets to the Handler to fund operation, only callable by Handler contract
    /// @param encodedAsset Encoded asset being requested
    /// @param value Amount of asset to send
    function requestAsset(
        EncodedAsset calldata encodedAsset,
        uint256 value
    ) external override whenNotPaused onlyHandler {
        AssetUtils.transferAssetTo(encodedAsset, address(_handler), value);
    }

    /**
      Process a bundle of operations.

      @dev The maximum gas cost of a call can be estimated without eth_estimateGas
      1. gas cost of `OperationUtils.computeOperationDigests` and
      `_verifyAllProofsMetered` can be estimated based on length of op.joinSplits
      and overall size of op
      2. maxmimum gas cost of each handleOperation can be estimated using op
      (refer to inline docs for `handleOperation`)
    */

    /// @notice Processes a bundle of operations. Verifies all proofs, then loops through each op
    ///         and passes to Handler for processing/execution. Emits one OperationProcessed event
    ///         per op.
    /// @param bundle Bundle of operations to process
    function processBundle(
        Bundle calldata bundle
    )
        external
        override
        whenNotPaused
        nonReentrant
        returns (OperationResult[] memory)
    {
        Operation[] calldata ops = bundle.operations;
        require(ops.length > 0, "empty bundle");

        uint256[] memory opDigests = OperationUtils.computeOperationDigests(
            ops
        );

        (bool success, uint256 perJoinSplitVerifyGas) = _verifyAllProofsMetered(
            ops,
            opDigests
        );

        require(success, "Batch JoinSplit verify failed");

        uint256 numOps = ops.length;
        OperationResult[] memory opResults = new OperationResult[](numOps);
        for (uint256 i = 0; i < numOps; i++) {
            try
                _handler.handleOperation(
                    ops[i],
                    perJoinSplitVerifyGas,
                    msg.sender
                )
            returns (OperationResult memory result) {
                opResults[i] = result;
            } catch (bytes memory reason) {
                // Indicates revert because of invalid chainid, expired
                // deadline, or error processing joinsplits. Bundler is not
                // compensated and we do not bubble up further OperationResult
                // info other than failureReason.
                string memory revertMsg = OperationUtils.getRevertMsg(reason);
                if (bytes(revertMsg).length == 0) {
                    opResults[i]
                        .failureReason = "handleOperation failed silently";
                } else {
                    opResults[i].failureReason = revertMsg;
                }
            }
            emit OperationProcessed(
                opDigests[i],
                opResults[i].opProcessed,
                opResults[i].assetsUnwrapped,
                opResults[i].failureReason,
                opResults[i].callSuccesses,
                opResults[i].callResults
            );
        }
        return opResults;
    }

    /// @notice Called when Teller is safe transferred an ERC721. Always returns valid selector.
    /// @dev We always return selector because the Handler will revert if the ERC721 contract is
    ///      not supported mid deposit. Thus any actual deposits of unsupported ERC721s will be
    ///      reverted too.
    function onERC721Received(
        address, // operator
        address, // from
        uint256, // tokenId
        bytes calldata // data
    ) external pure override returns (bytes4) {
        return IERC721ReceiverUpgradeable.onERC721Received.selector;
    }

    /// @notice Called when Teller is safe transferred an ERC1155. Always returns valid selector.
    /// @dev Same rationale for ERC1155 received as ERC721 (above).
    function onERC1155Received(
        address, // operator
        address, // from
        uint256, // id
        uint256, // value
        bytes calldata // data
    ) external pure override returns (bytes4) {
        return IERC1155ReceiverUpgradeable.onERC1155Received.selector;
    }

    /// @notice Called when Teller is safe batch transferred an ERC1155. Always returns valid
    ///         selector.
    /// @dev Same rationale for ERC1155 batched received as ERC721 (above).
    function onERC1155BatchReceived(
        address, // operator
        address, // from
        uint256[] calldata, // ids
        uint256[] calldata, // values
        bytes calldata // data
    ) external pure override returns (bytes4) {
        return IERC1155ReceiverUpgradeable.onERC1155BatchReceived.selector;
    }

    /// @notice Indicates to caller that Tandler supports ERC165, ERC721Receiver, and
    ///         ERC1155Receiver
    function supportsInterface(
        bytes4 interfaceId
    ) external pure override returns (bool) {
        return
            (interfaceId == type(IERC165Upgradeable).interfaceId) ||
            (interfaceId == type(IERC721ReceiverUpgradeable).interfaceId) ||
            (interfaceId == type(IERC1155ReceiverUpgradeable).interfaceId);
    }

    /// @notice Verifies or batch verifies joinSplit proofs for an array of operations.
    /// @dev If there is a single proof, it is cheaper to single verify. If multiple proofs,
    ///      we batch verify.
    /// @param ops Array of operations
    /// @param opDigests Array of operation digests in same order as the ops
    /// @return success Whether or not all proofs were successfully verified
    /// @return perJoinSplitVerifyGas Gas cost of verifying a single joinSplit proof (total batch
    ///         verification cost divided by number of proofs)
    function _verifyAllProofsMetered(
        Operation[] calldata ops,
        uint256[] memory opDigests
    ) internal view returns (bool success, uint256 perJoinSplitVerifyGas) {
        uint256 preVerificationGasLeft = gasleft();

        (uint256[8][] memory proofs, uint256[][] memory allPis) = OperationUtils
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
}
