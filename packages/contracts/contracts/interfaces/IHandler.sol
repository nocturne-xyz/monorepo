//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.17;
pragma abicoder v2;

import "../libs/Types.sol";

interface IHandler {
    function processOperation(
        Operation calldata op,
        uint256 perJoinSplitVerifyGas,
        address bundler
    ) external returns (OperationResult memory);

    function handleDeposit(DepositRequest calldata deposit) external;
}
