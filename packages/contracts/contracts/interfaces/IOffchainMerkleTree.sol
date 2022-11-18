// SPDX-License-Identifier: MIT
pragma solidity ^0.8.5;

interface IOffchainMerkleTree {
	function getRoot() external view returns (uint256);

	function committedCount() external view returns (uint128);

    function totalCount() external view returns (uint128);

	function getBatchLen() external view returns (uint128);

	function insertLeafToQueue(uint256 leaf) external;

	function insertLeavesToQueue(uint256[] memory leaves) external;

	function commitSubtree(uint256 newRoot, uint256[8] calldata proof) external;
}
