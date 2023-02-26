//SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.17;

import "forge-std/Test.sol";
import "forge-std/StdJson.sol";
import "forge-std/console.sol";

struct ExpectOperationProcessedArgs {
    bool wasProcessed;
    string failureReason;
}

contract ForgeUtils is Test {
    event OperationProcessed(
        uint256 indexed operationDigest,
        bool indexed opProcessed,
        string failureReason,
        bool[] callSuccesses,
        bytes[] callResults
    );

    function vmExpectOperationProcessed(
        ExpectOperationProcessedArgs memory args
    ) internal {
        vm.expectEmit(false, true, true, false);
        bool[] memory callSuccesses = new bool[](1);
        callSuccesses[0] = true;
        bytes[] memory callResults = new bytes[](1);
        emit OperationProcessed(
            uint256(0),
            args.wasProcessed,
            args.failureReason,
            callSuccesses,
            callResults
        );
    }
}
