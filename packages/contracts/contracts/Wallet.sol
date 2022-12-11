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

    modifier onlyThis() {
        require(msg.sender == address(this), "Only the Teller can call this");
        _;
    }

    // Verifies the joinsplit proofs of a bundle of transactions
    // DOES NOT check if nullifiers in each transaction has not been used
    function _verifyBundle(
        Bundle calldata bundle
    ) internal view returns (bool) {
        uint256 numOps = bundle.operations.length;

        // compute number of joinsplits in the bundle
        uint256 numJoinSplits = 0;
        for (uint256 i = 0; i < numOps; i++) {
            Operation calldata op = bundle.operations[i];
            numJoinSplits += op.joinSplitTxs.length;
        }
        Groth16.Proof[] memory proofs = new Groth16.Proof[](numJoinSplits);
        uint256[][] memory allPis = new uint256[][](numJoinSplits);

        // current index into proofs and pis
        uint256 index = 0;

        // Batch verify all the joinsplit proofs
        for (uint256 i = 0; i < numOps; i++) {
            Operation calldata op = bundle.operations[i];
            uint256 operationDigest = uint256(_hashOperation(op)) %
                Utils.SNARK_SCALAR_FIELD;
            for (uint256 j = 0; j < op.joinSplitTxs.length; j++) {
                proofs[index] = Utils.proof8ToStruct(op.joinSplitTxs[j].proof);
                allPis[index] = new uint256[](9);
                allPis[index][0] = op.joinSplitTxs[j].newNoteACommitment;
                allPis[index][1] = op.joinSplitTxs[j].newNoteBCommitment;
                allPis[index][2] = op.joinSplitTxs[j].commitmentTreeRoot;
                allPis[index][3] = op.joinSplitTxs[j].publicSpend;
                allPis[index][4] = op.joinSplitTxs[j].nullifierA;
                allPis[index][5] = op.joinSplitTxs[j].nullifierB;
                allPis[index][6] = operationDigest;
                allPis[index][7] = uint256(uint160(op.joinSplitTxs[j].asset));
                allPis[index][8] = op.joinSplitTxs[j].id;
                index++;
            }
        }

        return joinSplitVerifier.batchVerifyProofs(proofs, allPis);
    }

    // TODO: do we want to return successes/results?
    function processBundle(
        Bundle calldata bundle
    )
        external
        override
        returns (bool[] memory successes, bytes[][] memory results)
    {
        require(
            _verifyBundle(bundle),
            "Batched JoinSplit proof verification failed."
        );

        uint256 numOps = bundle.operations.length;

        successes = new bool[](numOps);
        results = new bytes[][](numOps);

        for (uint256 i = 0; i < numOps; i++) {
            Operation calldata op = bundle.operations[i];
            this.performOperation{gas: op.gasLimit}(op);
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
    ) external onlyThis returns (bool success, bytes[] memory results) {
        _handleAllSpends(op.joinSplitTxs, op.tokens);

        Action[] calldata actions = op.actions;
        uint256 numActions = actions.length;
        results = new bytes[](numActions);
        for (uint256 i = 0; i < numActions; i++) {
            results[i] = _makeExternalCall(actions[i]);
        }

        // handles refunds and resets balances
        _handleAllRefunds(
            op.tokens.spendTokens,
            op.tokens.refundTokens,
            op.refundAddr
        );
    }

    function _makeExternalCall(
        Action calldata action
    ) internal returns (bytes memory) {
        require(
            action.contractAddress != address(vault),
            "Cannot call the Nocturne vault"
        );

        (bool success, bytes memory result) = action.contractAddress.call(
            action.encodedFunction
        );

        require(success, "Function call failed");
        return result;
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
