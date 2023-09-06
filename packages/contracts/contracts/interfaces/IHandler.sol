//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.17;

import "../libs/Types.sol";

interface IHandler {
    function handleOperation(
        Operation calldata op,
        uint256 perJoinSplitVerifyGas,
        address bundler
    ) external returns (OperationResult memory);

    function handleDeposit(
        Deposit calldata deposit
    ) external returns (uint128 merkleIndex);
}
