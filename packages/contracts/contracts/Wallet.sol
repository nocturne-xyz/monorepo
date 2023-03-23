//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.17;
pragma abicoder v2;

import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {Versioned} from "./upgrade/Versioned.sol";
import {IWallet} from "./interfaces/IWallet.sol";
import {IHandler} from "./interfaces/IHandler.sol";
import {IJoinSplitVerifier} from "./interfaces/IJoinSplitVerifier.sol";
import {Utils} from "./libs/Utils.sol";
import {AssetUtils} from "./libs/AssetUtils.sol";
import {WalletUtils} from "./libs/WalletUtils.sol";
import {Groth16} from "./libs/WalletUtils.sol";
import {Vault} from "./Vault.sol";
import "./libs/Types.sol";

// TODO: use SafeERC20 library
// TODO: do we need IWallet and IVault? Can probably remove
contract Wallet is
    IWallet,
    Vault,
    ReentrancyGuardUpgradeable,
    OwnableUpgradeable,
    Versioned
{
    using OperationLib for Operation;

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
        string failureReason,
        bool[] callSuccesses,
        bytes[] callResults
    );

    function initialize(
        address handler,
        address joinSplitVerifier
    ) external initializer {
        __Ownable_init();
        __Vault_init(handler);
        _joinSplitVerifier = IJoinSplitVerifier(joinSplitVerifier);
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

    modifier onlyThis() {
        require(msg.sender == address(this), "Only wallet");
        _;
    }

    modifier onlyHandler() {
        require(msg.sender == address(_handler), "Not called from Wallet");
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

    function depositFunds(
        DepositRequest calldata deposit
    ) external override onlyDepositSource {
        _makeDeposit(deposit);
        _handler.handleDeposit(deposit);
    }

    function requestAsset(
        EncodedAsset calldata encodedAsset,
        uint256 value
    ) external override onlyHandler {
        _requestAsset(encodedAsset, value);
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
                _handler.processOperation(
                    ops[i],
                    perJoinSplitVerifyGas,
                    msg.sender
                )
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
}
