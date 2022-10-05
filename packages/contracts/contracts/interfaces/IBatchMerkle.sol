//SPDX-License-Identifier: Unlicense
pragma solidity 0.7.6;

import "./IWallet.sol";

interface IBatchMerkle {
    function root() external view returns (uint256);

    function commit8FromQueue() external;

    function insertLeafToQueue(uint256 leaf) external;
}
