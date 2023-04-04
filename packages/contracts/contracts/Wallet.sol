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
import {IWallet} from "./interfaces/IWallet.sol";
import {IHandler} from "./interfaces/IHandler.sol";
import {IJoinSplitVerifier} from "./interfaces/IJoinSplitVerifier.sol";
import {Utils} from "./libs/Utils.sol";
import {AssetUtils} from "./libs/AssetUtils.sol";
import {OperationUtils} from "./libs/OperationUtils.sol";
import {Groth16} from "./libs/OperationUtils.sol";
import "./libs/Types.sol";

contract Wallet is
    IWallet,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable,
    OwnableUpgradeable,
    IERC721ReceiverUpgradeable,
    IERC1155ReceiverUpgradeable,
    Versioned
{
    using OperationLib for Operation;

    IHandler public _handler;

    IJoinSplitVerifier public _joinSplitVerifier;

    mapping(address => bool) public _depositSources;

    mapping(address => bool) public _subtreeBatchFiller;

    // gap for upgrade safety
    uint256[50] private __GAP;

    event DepositSourcePermissionSet(address source, bool permission);

    event SubtreeBatchFillerPermissionSet(address filler, bool permission);

    event OperationProcessed(
        uint256 indexed operationDigest,
        bool indexed opProcessed,
        bool indexed assetsUnwrapped,
        string failureReason,
        bool[] callSuccesses,
        bytes[] callResults
    );

    function initialize(
        address handler,
        address joinSplitVerifier
    ) external initializer {
        __Ownable_init();
        __Pausable_init();
        _handler = IHandler(handler);
        _joinSplitVerifier = IJoinSplitVerifier(joinSplitVerifier);
    }

    modifier onlyThis() {
        require(msg.sender == address(this), "Only wallet");
        _;
    }

    modifier onlyHandler() {
        require(msg.sender == address(_handler), "Only handler");
        _;
    }

    modifier onlyDepositSource() {
        require(_depositSources[msg.sender], "Only deposit source");
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

    function setDepositSourcePermission(
        address source,
        bool permission
    ) external onlyOwner {
        _depositSources[source] = permission;
        emit DepositSourcePermissionSet(source, permission);
    }

    // gives an address permission to call `fillBatchesWithZeros`
    function setSubtreeBatchFillerPermission(
        address filler,
        bool permission
    ) external onlyOwner {
        _subtreeBatchFiller[filler] = permission;
        emit SubtreeBatchFillerPermissionSet(filler, permission);
    }

    function depositFunds(
        DepositRequest calldata deposit
    ) external override whenNotPaused onlyDepositSource {
        _handler.handleDeposit(deposit);
        AssetUtils.transferAssetFrom(
            deposit.encodedAsset,
            msg.sender,
            deposit.value
        );
    }

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
                opResults[i].failureReason = Utils.getRevertMsg(reason);
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

    // Verifies the joinsplit proofs of a bundle of transactions
    // Also returns the gas used to verify per joinsplit
    // DOES NOT check if nullifiers in each transaction has not been used
    function _verifyAllProofsMetered(
        Operation[] calldata ops,
        uint256[] memory opDigests
    ) internal view returns (bool success, uint256 perJoinSplitVerifyGas) {
        uint256 preVerificationGasLeft = gasleft();

        (
            Groth16.Proof[] memory proofs,
            uint256[][] memory allPis
        ) = OperationUtils.extractJoinSplitProofsAndPis(ops, opDigests);

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

    function onERC721Received(
        address, // operator
        address, // from
        uint256, // tokenId
        bytes calldata // data
    ) external pure override returns (bytes4) {
        return IERC721ReceiverUpgradeable.onERC721Received.selector;
    }

    function onERC1155Received(
        address, // operator
        address, // from
        uint256, // id
        uint256, // value
        bytes calldata // data
    ) external pure override returns (bytes4) {
        return IERC1155ReceiverUpgradeable.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address, // operator
        address, // from
        uint256[] calldata, // ids
        uint256[] calldata, // values
        bytes calldata // data
    ) external pure override returns (bytes4) {
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
}
