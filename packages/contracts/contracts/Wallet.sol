//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.17;
pragma abicoder v2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import {IWallet} from "./interfaces/IWallet.sol";
import {IJoinSplitVerifier} from "./interfaces/IJoinSplitVerifier.sol";
import "./interfaces/IHandler.sol";
import "./libs/WalletUtils.sol";
import "./libs/types.sol";
import "./Handler.sol";
import "./upgrade/Versioned.sol";

// TODO: use SafeERC20 library
contract Wallet is IWallet, Initializable, Versioned {
    using OperationLib for Operation;

    IHandler public _handler;

    IJoinSplitVerifier public _joinSplitVerifier;

    // gap for upgrade safety
    uint256[50] private __GAP;

    function initialize(
        address handler,
        address joinSplitVerifier
    ) external initializer {
        _handler = IHandler(handler);
        _joinSplitVerifier = IJoinSplitVerifier(joinSplitVerifier);
    }

    event OperationProcessed(
        uint256 indexed operationDigest,
        bool indexed opProcessed,
        string failureReason,
        bool[] callSuccesses,
        bytes[] callResults
    );

    modifier onlyThis() {
        require(msg.sender == address(this), "only Wallet");
        _;
    }

    function depositFunds(Deposit calldata deposit) external override {
        require(deposit.spender == msg.sender, "Spender must be the sender");

        _handler.handleDeposit(deposit);
    }

    /**
      Process a bundle of operations.

      @dev The maximum gas cost of a call can be estimated without eth_estimateGas
      1. gas cost of `WalletUtils.computeOperationDigests` and
      `_verifyAllProofsMetered` can be estimated based on length of op.joinSplitTxs
      and overall size of op
      2. maxmimum gas cost of each processOperation can be estimated using op
      (refer to inline docs for `processOperation`)
    */
    function processBundle(
        Bundle calldata bundle
    ) external override returns (OperationResult[] memory) {
        Operation[] calldata ops = bundle.operations;
        uint256[] memory opDigests = WalletUtils.computeOperationDigests(ops);

        (bool success, uint256 perJoinSplitGas) = _verifyAllProofsMetered(
            ops,
            opDigests
        );

        require(success, "Batched JoinSplit verify failed.");

        uint256 numOps = ops.length;
        OperationResult[] memory opResults = new OperationResult[](numOps);
        for (uint256 i = 0; i < numOps; i++) {
            uint256 verificationGasForOp = WalletUtils.verificationGasForOp(
                ops[i],
                perJoinSplitGas
            );

            try
                _handler.handleOperation(
                    ops[i],
                    verificationGasForOp,
                    msg.sender
                )
            returns (OperationResult memory result) {
                opResults[i] = result;
            } catch (bytes memory reason) {
                opResults[i] = WalletUtils.failOperationWithReason(
                    WalletUtils.getRevertMsg(reason)
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
    ) internal view returns (bool success, uint256 perJoinSplitGas) {
        uint256 preVerificationGasLeft = gasleft();

        (Groth16.Proof[] memory proofs, uint256[][] memory allPis) = WalletUtils
            .extractJoinSplitProofsAndPis(ops, opDigests);
        success = _joinSplitVerifier.batchVerifyProofs(proofs, allPis);

        perJoinSplitGas = (preVerificationGasLeft - gasleft()) / proofs.length;
        return (success, perJoinSplitGas);
    }
}
