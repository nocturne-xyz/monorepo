// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "../../../libs/Types.sol";

library LibDepositRequestArray {
    function pop(DepositRequest[] storage self, uint256 index) internal {
        require(index < self.length);
        self[index] = self[self.length - 1];
        self.pop();
    }
}
