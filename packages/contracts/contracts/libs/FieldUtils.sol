// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.5;

// helpers for converting to/from field elems, uint256s, and/or bytes, and hashing them
library FieldUtils  {
	// pack array of field elements / uint256s to big-endian bytes
	function packFieldElems(uint256[] memory elems) pure internal returns (bytes memory) {
		bytes memory res = new bytes(elems.length * 32);
        for (uint256 i = 0; i < elems.length; i++) {
			uint256 elem = elems[i];
            for (uint256 j = 31; j > 0; j--) {
				uint8 b = uint8(elem & uint256(0xFF));
            	res[32 * i + j] = bytes1(b);
                elem >>= 8;
            }
        }

		return res;
	}

	// hash array of field elements / uint256s as big-endian bytes with sha256
	function sha256FieldElems(uint256[] memory elems) pure internal returns (bytes32) {
		bytes memory packed = packFieldElems(elems);
		return sha256(packed);
	}

	function bytes32ToBEUint256(bytes32 buf) pure internal returns (uint256) {
		uint256 sum = 0;
		for (uint256 i = 0; i < 32; i++) {
			sum <<= 8;
			sum |= uint256(uint8(buf[i]));
		}

		return sum;
	}

	// return uint256 as two limbs - one uint256 containing the 3 hi bits, the other containing the lower 253 bits
	function uint256ToFieldElemLimbs(uint256 n) pure internal returns (uint256, uint256) {
		uint256 hi = n >> 253;
		uint256 lo = n & ((1 << 253) - 1);
		return (hi, lo);
	}

	// hash array of field elements / uint256s as big-endian bytes with sha256 and return result as big-endian uint256
	function sha256FieldElemsToUint256(uint256[] memory elems) pure internal returns (uint256) {
		bytes32 digest = sha256FieldElems(elems);
		return bytes32ToBEUint256(digest);
	}
}
