//SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.17;

import "../../libs/Types.sol";

contract TestOperationLib {
    using OperationLib for Operation;

    constructor() {}

    function ensureValidEncodedAssetsWithLastIndex(
        Operation calldata op
    ) external pure {
        return op.ensureValidEncodedAssetsWithLastIndex();
    }
}
