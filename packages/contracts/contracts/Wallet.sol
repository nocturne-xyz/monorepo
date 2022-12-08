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
        Bundle calldata _bundle
    ) external override returns (IWallet.OperationResult[] memory _opResults) {
        uint256 _numOps = _bundle.operations.length;

        _opResults = new IWallet.OperationResult[](_numOps);
        for (uint256 i = 0; i < _numOps; i++) {
            Operation calldata op = _bundle.operations[i];
            _opResults[i] = this.performOperation{gas: op.gasLimit}(op);
        }
    }

    function batchDepositFunds(
        Deposit[] calldata _deposits,
        Signature[] calldata _sigs
    ) external override {
        Deposit[] memory _approvedDeposits = new Deposit[](_deposits.length);
        uint256 _numApprovedDeposits;
        for (uint256 i = 0; i < _deposits.length; i++) {
            if (_verifyApprovalSig(_deposits[i], _sigs[i])) {
                _approvedDeposits[_numApprovedDeposits] = _deposits[i];
                _numApprovedDeposits++;
            }
        }

        _makeBatchDeposit(_approvedDeposits, _numApprovedDeposits);
    }

    function depositFunds(Deposit calldata _deposit) external override {
        require(_deposit.spender == msg.sender, "Spender must be the sender");

        _makeDeposit(_deposit);
    }

    function performOperation(
        Operation calldata _op
    ) external onlyThis returns (IWallet.OperationResult memory _opResult) {
        uint256 _opDigest = _operationDigest(_op);
        _handleAllSpends(_op.joinSplitTxs, _op.tokens, _opDigest);

        Action[] calldata _actions = _op.actions;
        uint256 _numActions = _actions.length;
        _opResult.opSuccess = true; // default to true
        _opResult.callSuccesses = new bool[](_numActions);
        _opResult.callResults = new bytes[](_numActions);
        for (uint256 i = 0; i < _numActions; i++) {
            (bool _success, bytes memory _result) = _makeExternalCall(
                _actions[i]
            );

            _opResult.callSuccesses[i] = _success;
            _opResult.callResults[i] = _result;
            if (_success == false) {
                _opResult.opSuccess = false; // set opSuccess to false if any call fails
            }
        }

        // handles refunds and resets balances
        _handleAllRefunds(
            _op.tokens.spendTokens,
            _op.tokens.refundTokens,
            _op.refundAddr
        );

        emit OperationProcessed(
            _opDigest,
            _opResult.opSuccess,
            _opResult.callSuccesses,
            _opResult.callResults
        );
    }

    function _makeExternalCall(
        Action calldata _action
    ) internal returns (bool _success, bytes memory _result) {
        require(
            _action.contractAddress != address(vault),
            "Cannot call the Nocturne vault"
        );

        (_success, _result) = _action.contractAddress.call(
            _action.encodedFunction
        );
    }

    function _operationDigest(
        Operation calldata _op
    ) private pure returns (uint256) {
        return uint256(_hashOperation(_op)) % Utils.SNARK_SCALAR_FIELD;
    }

    // TODO: do we need a domain in the payload?
    // TODO: turn encodedFunctions and contractAddresses into their own arrays, so we don't have to call abi.encodePacked for each one
    function _hashOperation(
        Operation calldata _op
    ) private pure returns (bytes32) {
        bytes memory _payload;

        Action calldata _action;
        for (uint256 i = 0; i < _op.actions.length; i++) {
            _action = _op.actions[i];
            _payload = abi.encodePacked(
                _payload,
                _action.contractAddress,
                keccak256(_action.encodedFunction)
            );
        }

        bytes memory _joinSplitTxsHash;
        for (uint256 i = 0; i < _op.joinSplitTxs.length; i++) {
            _joinSplitTxsHash = abi.encodePacked(
                _joinSplitTxsHash,
                _hashJoinSplit(_op.joinSplitTxs[i])
            );
        }

        bytes32 _spendTokensHash = keccak256(
            abi.encodePacked(_op.tokens.spendTokens)
        );
        bytes32 _refundTokensHash = keccak256(
            abi.encodePacked(_op.tokens.refundTokens)
        );

        _payload = abi.encodePacked(
            _payload,
            _joinSplitTxsHash,
            _op.refundAddr.h1X,
            _op.refundAddr.h1Y,
            _op.refundAddr.h2X,
            _op.refundAddr.h2Y,
            _spendTokensHash,
            _refundTokensHash,
            _op.gasLimit
        );

        return keccak256(_payload);
    }

    function _hashJoinSplit(
        IWallet.JoinSplitTransaction calldata _joinSplit
    ) private pure returns (bytes32) {
        bytes memory _payload = abi.encodePacked(
            _joinSplit.commitmentTreeRoot,
            _joinSplit.nullifierA,
            _joinSplit.nullifierB,
            _joinSplit.newNoteACommitment,
            _joinSplit.newNoteBCommitment,
            _joinSplit.publicSpend,
            _joinSplit.asset,
            _joinSplit.id
        );

        return keccak256(_payload);
    }

    function _verifyApprovalSig(
        Deposit calldata _deposit,
        Signature calldata _sig
    ) private view returns (bool _valid) {
        bytes32 _payloadHash = keccak256(
            abi.encodePacked(
                _deposit.asset,
                _deposit.value,
                _deposit.spender,
                _deposit.id,
                _deposit.depositAddr.h1X,
                _deposit.depositAddr.h1Y,
                _deposit.depositAddr.h2X,
                _deposit.depositAddr.h2Y
            )
        );

        bytes32 _msgHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", _payloadHash)
        );

        address _recoveredAddress = ecrecover(_msgHash, _sig.v, _sig.r, _sig.s);

        if (
            _recoveredAddress != address(0) &&
            _recoveredAddress == _deposit.spender
        ) {
            _valid = true;
        } else {
            _valid = false;
        }
    }
}
