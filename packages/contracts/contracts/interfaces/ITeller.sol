//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.17;
pragma abicoder v2;

import "../libs/Types.sol";

interface ITeller {
    function processBundle(
        Bundle calldata bundle
    ) external returns (OperationResult[] memory opResults);

    function depositFunds(Deposit calldata deposit) external returns (uint128 merkleIndex);

    function requestAsset(
        EncodedAsset calldata encodedAsset,
        uint256 value
    ) external;
}
