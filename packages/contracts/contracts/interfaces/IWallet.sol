//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.17;
pragma abicoder v2;

import "../libs/types.sol";

interface IWallet {
    function processBundle(
        Bundle calldata bundle
    ) external returns (OperationResult[] memory opResults);

    function depositFunds(Deposit calldata deposit) external;
}
