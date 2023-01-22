//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.17;
pragma abicoder v2;

import "../libs/types.sol";

interface IAccountant {
    function requestAsset(
        EncodedAsset calldata encodedAsset,
        uint256 value
    ) external;

    function makeDeposit(Deposit calldata deposit) external;

    function handleRefundNote(RefundNote memory refund) external;

    function handleJoinSplit(
        JoinSplitTransaction calldata joinSplitTx
    ) external;
}
