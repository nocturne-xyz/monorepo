// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

// Modified from ReentrancyGuard.sol from OpenZeppelin contracts
contract NocturneReentrancyGuard is Initializable {
    uint256 public constant NOT_ENTERED = 1;
    uint256 public constant ENTERED_PREFILL = 2;
    uint256 public constant ENTERED_HANDLE_OPERATION = 3;
    uint256 public constant ENTERED_EXECUTE_ACTIONS = 4;

    uint256 private _operationStage;

    // gap for upgrade safety
    uint256[50] private __GAP;

    function __NocturneReentrancyGuard_init() internal onlyInitializing {
        _operationStage = NOT_ENTERED;
    }

    modifier addToAssetPrefillGuard() {
        require(
            _operationStage == NOT_ENTERED,
            "Reentry into addAssetToPrefill"
        );
        _operationStage = ENTERED_PREFILL;

        _;

        _operationStage = NOT_ENTERED;
    }

    modifier handleOperationGuard() {
        require(_operationStage == NOT_ENTERED, "Reentry into handleOperation");
        _operationStage = ENTERED_HANDLE_OPERATION;

        _;

        _operationStage = NOT_ENTERED;
    }

    modifier executeActionsGuard() {
        require(
            _operationStage == ENTERED_HANDLE_OPERATION,
            "Reentry into executeActions"
        );
        _operationStage = ENTERED_EXECUTE_ACTIONS;

        _;

        _operationStage = ENTERED_HANDLE_OPERATION;
    }

    /**
     * @dev Returns true if the reentrancy guard is currently set to "entered", which indicates there is a
     * `nonReentrant` function in the call stack.
     */
    function reentrancyGuardStage() public view returns (uint256) {
        return _operationStage;
    }
}
