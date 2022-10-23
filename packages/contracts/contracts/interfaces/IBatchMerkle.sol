//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

import "./IWallet.sol";

interface IBatchMerkle {
    function root() external view returns (uint256);

    function tentativeCount() external view returns (uint256);

    function commit2FromQueue() external;

    function commit8FromQueue() external;

    function insertLeafToQueue(uint256 leaf) external;

    function insertLeavesToQueue(uint256[] memory leaves) external;
}
