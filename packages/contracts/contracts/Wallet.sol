//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.5;
pragma abicoder v2;

import "./interfaces/IWallet.sol";
import "./interfaces/IVault.sol";
import "./libs/WalletUtils.sol";
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
    function _verifyAllProofs(
        OperationAndDigest[] memory _opsAndDigests
    ) internal view returns (bool) {
        (Groth16.Proof[] memory proofs, uint256[][] memory allPis) = WalletUtils
            .extractJoinSplitProofsAndPisFromBundle(_opsAndDigests);
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
        uint256[] memory _opsAndDigests = WalletUtils.extractOperationsAndDigestsFromBundle(bundle);

        require(
            _verifyAllProofsInBundle(_opsAndDigests),
            "Batched JoinSplit proof verification failed."
        );

        uint256 numOps = bundle.operations.length;

        successes = new bool[](numOps);
        results = new bytes[][](numOps);
        for (uint256 i = 0; i < numOps; i++) {
            Operation calldata op = bundle.operations[i];
            (bool opSuccess, bytes[] memory opRes) = this.performOperation{
                gas: op.gasLimit
            }(op);
            successes[i] = opSuccess;
            results[i] = opRes;
        }
    }

    // TODO: refactor batch deposit
    function batchDepositFunds(
        Deposit[] calldata deposits,
        Signature[] calldata sigs
    ) external override {
        Deposit[] memory approvedDeposits = new Deposit[](deposits.length);
        uint256 numApprovedDeposits;
        for (uint256 i = 0; i < deposits.length; i++) {
            if (WalletUtils.verifyApprovalSig(deposits[i], sigs[i])) {
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
        OperationAndDigest calldata _opAndDigest
    ) external onlyThis returns (bool success, bytes[] memory results) {
        Operation memory op = _opAndDigest.operation;
        _handleAllSpends(op.joinSplitTxs, op.tokens);

        Action[] calldata actions = op.actions;
        uint256 numActions = actions.length;
        opSuccess = true; // default to true, set false if any call fails
        callResults = new bytes[](numActions);
        for (uint256 i = 0; i < numActions; i++) {
            (bool success, bytes memory res) = _makeExternalCall(actions[i]);

            callResults[i] = res;
            if (success == false) {
                opSuccess = false;
            }
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
    ) internal returns (bool success, bytes memory result) {
        require(
            action.contractAddress != address(vault),
            "Cannot call the Nocturne vault"
        );

        (success, result) = action.contractAddress.call(action.encodedFunction);
    }
}
