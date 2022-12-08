//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.5;
pragma abicoder v2;

import "./interfaces/IWallet.sol";
import "./interfaces/IVault.sol";
import "./BalanceManager.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

import "hardhat/console.sol";

// TODO: use SafeERC20 library
// TODO: separate note commitment tree and nullifier set into its own contract to allow for upgradeability? Wallet should be upgradeable, but vault shouldn't
// TODO: add events
// TODO: add gas handling
// TODO: make sure all values given to proofs < SNARK_SCALAR_FIELD
contract Wallet is IWallet, BalanceManager {
    constructor(
        address _vault,
        address _joinSplitVerifier,
        address _subtreeUpdateVerifier
    ) BalanceManager(_vault, _joinSplitVerifier, _subtreeUpdateVerifier) {} // solhint-disable-line no-empty-blocks

    event OperationProcessed(
        uint256 indexed operationDigest,
        bool indexed opSuccess,
        bool[] callSuccesses,
        bytes[] callResults
    );

    modifier onlyThis() {
        require(msg.sender == address(this), "Only the Teller can call this");
        _;
    }

    function processBundle(
        Bundle calldata bundle
    ) external override returns (IWallet.OperationResult[] memory opResults) {
        uint256 numOps = bundle.operations.length;

        opResults = new IWallet.OperationResult[](numOps);
        for (uint256 i = 0; i < numOps; i++) {
            Operation calldata op = bundle.operations[i];
            opResults[i] = this.performOperation{gas: op.gasLimit}(op);
        }
    }

    function batchDepositFunds(
        Deposit[] calldata deposits,
        Signature[] calldata sigs
    ) external override {
        Deposit[] memory approvedDeposits = new Deposit[](deposits.length);
        uint256 numApprovedDeposits;
        for (uint256 i = 0; i < deposits.length; i++) {
            if (_verifyApprovalSig(deposits[i], sigs[i])) {
                approvedDeposits[numApprovedDeposits] = deposits[i];
                numApprovedDeposits++;
            }
        }

        _makeBatchDeposit(approvedDeposits, numApprovedDeposits);
    }

    function depositFunds(Deposit calldata deposit) external override {
        require(deposit.spender == msg.sender, "Spender must be the sender");

        _makeDeposit(deposit);
    }

    function performOperation(
        Operation calldata op
    ) external onlyThis returns (IWallet.OperationResult memory opResult) {
        uint256 _opDigest = _operationDigest(op);
        _handleAllSpends(op.joinSplitTxs, op.tokens, _opDigest);

        Action[] calldata actions = op.actions;
        uint256 numActions = actions.length;
        opResult.opSuccess = true; // default to true
        opResult.callSuccesses = new bool[](numActions);
        opResult.callResults = new bytes[](numActions);
        for (uint256 i = 0; i < numActions; i++) {
            (bool success, bytes memory result) = _makeExternalCall(actions[i]);

            opResult.callSuccesses[i] = success;
            opResult.callResults[i] = result;
            if (success == false) {
                opResult.opSuccess = false; // set opSuccess to false if any call fails
            }
        }

        // handles refunds and resets balances
        _handleAllRefunds(
            op.tokens.spendTokens,
            op.tokens.refundTokens,
            op.refundAddr
        );

        emit OperationProcessed(
            _opDigest,
            opResult.opSuccess,
            opResult.callSuccesses,
            opResult.callResults
        );
    }

    function _makeExternalCall(
        Action calldata action
    ) internal returns (bool success, bytes memory result) {
        require(
            action.contractAddress != address(vault),
            "Cannot call the Nocturne vault"
        );

        (success, result) = action.contractAddress.call(action.encodedFunction);
    }

    function _operationDigest(
        Operation calldata op
    ) private pure returns (uint256) {
        return uint256(_hashOperation(op)) % Utils.SNARK_SCALAR_FIELD;
    }

    // TODO: do we need a domain in the payload?
    // TODO: turn encodedFunctions and contractAddresses into their own arrays, so we don't have to call abi.encodePacked for each one
    function _hashOperation(
        Operation calldata op
    ) private pure returns (bytes32) {
        bytes memory payload;

        Action calldata action;
        for (uint256 i = 0; i < op.actions.length; i++) {
            action = op.actions[i];
            payload = abi.encodePacked(
                payload,
                action.contractAddress,
                keccak256(action.encodedFunction)
            );
        }

        bytes memory joinSplitTxsHash;
        for (uint256 i = 0; i < op.joinSplitTxs.length; i++) {
            joinSplitTxsHash = abi.encodePacked(
                joinSplitTxsHash,
                _hashJoinSplit(op.joinSplitTxs[i])
            );
        }

        bytes32 spendTokensHash = keccak256(
            abi.encodePacked(op.tokens.spendTokens)
        );
        bytes32 refundTokensHash = keccak256(
            abi.encodePacked(op.tokens.refundTokens)
        );

        payload = abi.encodePacked(
            payload,
            joinSplitTxsHash,
            op.refundAddr.h1X,
            op.refundAddr.h1Y,
            op.refundAddr.h2X,
            op.refundAddr.h2Y,
            spendTokensHash,
            refundTokensHash,
            op.gasLimit
        );

        return keccak256(payload);
    }

    function _hashJoinSplit(
        IWallet.JoinSplitTransaction calldata joinSplit
    ) private pure returns (bytes32) {
        bytes memory payload = abi.encodePacked(
            joinSplit.commitmentTreeRoot,
            joinSplit.nullifierA,
            joinSplit.nullifierB,
            joinSplit.newNoteACommitment,
            joinSplit.newNoteBCommitment,
            joinSplit.publicSpend,
            joinSplit.asset,
            joinSplit.id
        );

        return keccak256(payload);
    }

    function _verifyApprovalSig(
        Deposit calldata deposit,
        Signature calldata sig
    ) private view returns (bool valid) {
        bytes32 payloadHash = keccak256(
            abi.encodePacked(
                deposit.asset,
                deposit.value,
                deposit.spender,
                deposit.id,
                deposit.depositAddr.h1X,
                deposit.depositAddr.h1Y,
                deposit.depositAddr.h2X,
                deposit.depositAddr.h2Y
            )
        );

        bytes32 msgHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", payloadHash)
        );

        address recoveredAddress = ecrecover(msgHash, sig.v, sig.r, sig.s);

        if (
            recoveredAddress != address(0) &&
            recoveredAddress == deposit.spender
        ) {
            valid = true;
        } else {
            valid = false;
        }
    }
}
