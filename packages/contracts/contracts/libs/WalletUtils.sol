// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.5;
import {IWallet} from "../interfaces/IWallet.sol";
import {Groth16} from "../libs/Groth16.sol";
import {Utils} from "../libs/Utils.sol";

// Helpers for Wallet.sol
library WalletUtils {
    function extractOperationsDigests(
        IWallet.Operation[] calldata _ops
    ) internal pure returns (uint256[] memory) {
        uint256 _numOps = _ops.length;
        uint256[] memory _opDigests = new uint256[](_numOps);
        for (uint256 i = 0; i < _numOps; i++) {
            _opDigests[i] = calculateOperationDigest(_ops[i]);
        }

        return _opDigests;
    }

    function extractJoinSplitProofsAndPis(
        IWallet.Operation[] calldata _ops,
        uint256[] memory _digests
    )
        internal
        pure
        returns (Groth16.Proof[] memory proofs, uint256[][] memory allPis)
    {
        uint256 numOps = _ops.length;

        // compute number of joinsplits in the bundle
        uint256 numJoinSplits = 0;
        for (uint256 i = 0; i < numOps; i++) {
            numJoinSplits += _ops[i].joinSplitTxs.length;
        }

        proofs = new Groth16.Proof[](numJoinSplits);
        allPis = new uint256[][](numJoinSplits);

        // current index into proofs and pis
        uint256 index = 0;

        // Batch verify all the joinsplit proofs
        for (uint256 i = 0; i < numOps; i++) {
            IWallet.Operation memory op = _ops[i];
            for (uint256 j = 0; j < op.joinSplitTxs.length; j++) {
                proofs[index] = Utils.proof8ToStruct(op.joinSplitTxs[j].proof);
                allPis[index] = new uint256[](9);
                allPis[index][0] = op.joinSplitTxs[j].newNoteACommitment;
                allPis[index][1] = op.joinSplitTxs[j].newNoteBCommitment;
                allPis[index][2] = op.joinSplitTxs[j].commitmentTreeRoot;
                allPis[index][3] = op.joinSplitTxs[j].publicSpend;
                allPis[index][4] = op.joinSplitTxs[j].nullifierA;
                allPis[index][5] = op.joinSplitTxs[j].nullifierB;
                allPis[index][6] = _digests[i];
                allPis[index][7] = uint256(uint160(op.joinSplitTxs[j].asset));
                allPis[index][8] = op.joinSplitTxs[j].id;
                index++;
            }
        }

        return (proofs, allPis);
    }

    function calculateOperationDigest(
        IWallet.Operation calldata _op
    ) internal pure returns (uint256) {
        return uint256(_hashOperation(_op)) % Utils.SNARK_SCALAR_FIELD;
    }

    // TODO: do we need a domain in the payload?
    // TODO: turn encodedFunctions and contractAddresses into their own arrays, so we don't have to call abi.encodePacked for each one
    function _hashOperation(
        IWallet.Operation calldata op
    ) private pure returns (bytes32) {
        bytes memory payload;

        IWallet.Action memory action;
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

    // TODO: refactor batch deposit
    function verifyApprovalSig(
        IWallet.Deposit calldata deposit,
        IWallet.Signature calldata sig
    ) internal pure returns (bool valid) {
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
