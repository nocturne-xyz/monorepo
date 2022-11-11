// SPDX-License-Identifier: MIT
pragma solidity ^0.8.5;
pragma abicoder v2;

import "forge-std/Test.sol";
import {TestUtils} from "./utils/TestUtils.sol";
import {PoseidonHasherT3} from "../PoseidonHashers.sol";
import {PoseidonDeployer} from "./utils/PoseidonDeployer.sol";
import {IHasherT3} from "../interfaces/IHasher.sol";

contract GetEmptySubtreeConstants is Test, TestUtils, PoseidonDeployer {
	IHasherT3 hasher;

	function setUp() public virtual {
		deployPoseidon3Through6();
		hasher = new PoseidonHasherT3(poseidonT3);
	}

	function testGetConstants4() public {
		uint256[31] memory nodes;
		uint256[5] memory constants;
		constants[0] = uint256(0);

		for (uint256 i = 1; i < 5; i++) {
			constants[i] = hasher.hash([constants[i-1], constants[i-1]]);
			console.log(constants[i]);
		}
	}
}
