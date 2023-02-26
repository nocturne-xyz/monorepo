// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

// Modified from ReentrancyGuard.sol from OpenZeppelin contracts
contract OperationReentrancyGuard is Initializable {
    uint256 public constant NO_OPERATION_ENTERED = 1;
    uint256 public constant ENTERED_PROCESS_OPERATION = 2;
    uint256 public constant ENTERED_EXECUTE_ACTIONS = 3;

    uint256 private _operationStage;

    // gap for upgrade safety
    uint256[50] private __GAP;

    function __OperationReentrancyGuard_init() internal onlyInitializing {
        _operationStage = NO_OPERATION_ENTERED;
    }

    modifier processOperationGuard() {
        require(
            _operationStage == NO_OPERATION_ENTERED,
            "Reentry into processOperation"
        );
        _operationStage = ENTERED_PROCESS_OPERATION;

        _;

        _operationStage = NO_OPERATION_ENTERED;
    }

    modifier executeActionsGuard() {
        require(
            _operationStage == ENTERED_PROCESS_OPERATION,
            "Reentry into executeActions"
        );
        _operationStage = ENTERED_EXECUTE_ACTIONS;

        _;

        _operationStage = ENTERED_PROCESS_OPERATION;
    }

    /**
     * @dev Returns true if the reentrancy guard is currently set to "entered", which indicates there is a
     * `nonReentrant` function in the call stack.
     */
    function reentrancyGuardStage() public view returns (uint256) {
        return _operationStage;
    }
}
