//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.17;
pragma abicoder v2;

import "../libs/types.sol";

interface IHandler {
    function handleDeposit(Deposit calldata deposit) external;

    function handleOperation(
        Operation calldata op,
        uint256 verificationGasForOp,
        address bundler
    ) external returns (OperationResult memory opResult);
}
