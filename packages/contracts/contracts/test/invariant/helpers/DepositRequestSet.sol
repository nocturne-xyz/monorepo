// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;
pragma abicoder v2;

import "../../../libs/Types.sol";

struct DepositRequestSet {
    mapping(address => DepositRequest[]) _map;
    mapping(address => uint256) _indexes;
}

library LibDepositRequestSet {
    function add(
        DepositRequestSet storage self,
        address key,
        DepositRequest memory value
    ) internal {
        self._map[key].push(value);
    }

    function remove(
        DepositRequestSet storage self,
        address key,
        uint256 index
    ) internal {
        require(index < self._map[key].length, "Index out of range");
        if (index < self._map[key].length - 1) {
            self._map[key][index] = self._map[key][self._map[key].length - 1];
        }
        self._map[key].pop();
    }

    function get(
        DepositRequestSet storage self,
        address key,
        uint256 index
    ) internal view returns (DepositRequest memory) {
        require(index < self._map[key].length, "Index out of range");
        return self._map[key][index];
    }

    function count(
        DepositRequestSet storage self,
        address key
    ) internal view returns (uint256) {
        return self._map[key].length;
    }
}
