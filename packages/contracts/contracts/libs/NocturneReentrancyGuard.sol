// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

// Modified from ReentrancyGuard.sol from OpenZeppelin contracts
contract NocturneReentrancyGuard {
    uint256 public constant NOT_ENTERED = 1;
    uint256 public constant ENTERED_PROCESS_OPERATION = 2;
    uint256 public constant ENTERED_EXECUTE_OPERATION = 3;

    uint256 private _operation_stage;

    constructor() {
        _operation_stage = NOT_ENTERED;
    }

    modifier processOperationGuard() {
        require(
            _operation_stage == NOT_ENTERED,
            "Reentry into processOperation"
        );
        _operation_stage = ENTERED_PROCESS_OPERATION;

        _;

        _operation_stage = NOT_ENTERED;
    }

    modifier executeOperationGuard() {
        require(
            _operation_stage == ENTERED_PROCESS_OPERATION,
            "Reentry into executeOperation"
        );
        _operation_stage = ENTERED_EXECUTE_OPERATION;

        _;

        _operation_stage = ENTERED_PROCESS_OPERATION;
    }

    /**
     * @dev Returns true if the reentrancy guard is currently set to "entered", which indicates there is a
     * `nonReentrant` function in the call stack.
     */
    function reentrancyGuardStage() public view returns (uint256) {
        return _operation_stage;
    }
}
