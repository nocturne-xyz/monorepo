//SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.17;

import "./interfaces/IHasherExt.sol";
import "./interfaces/IPoseidonExt.sol";

contract PoseidonExtHasherT3 is IHasherExtT3 {
    IPoseidonExtT3 public poseidonExtT3;

    constructor(address _poseidonExtT3) {
        poseidonExtT3 = IPoseidonExtT3(_poseidonExtT3);
    }

    function hash(
        uint256 initialState,
        uint256[2] memory elems
    ) external view override returns (uint256) {
        return poseidonExtT3.poseidonExt(initialState, elems);
    }
}

contract PoseidonExtHasherT4 is IHasherExtT4 {
    IPoseidonExtT4 public poseidonExtT4;

    constructor(address _poseidonExtT4) {
        poseidonExtT4 = IPoseidonExtT4(_poseidonExtT4);
    }

    function hash(
        uint256 initialState,
        uint256[3] memory elems
    ) external view override returns (uint256) {
        return poseidonExtT4.poseidonExt(initialState, elems);
    }
}

contract PoseidonExtHasherT7 is IHasherExtT7 {
    IPoseidonExtT7 public poseidonExtT7;

    constructor(address _poseidonExtT7) {
        poseidonExtT7 = IPoseidonExtT7(_poseidonExtT7);
    }

    function hash(
        uint256 initialState,
        uint256[6] memory elems
    ) external view override returns (uint256) {
        return poseidonExtT7.poseidonExt(initialState, elems);
    }
}
