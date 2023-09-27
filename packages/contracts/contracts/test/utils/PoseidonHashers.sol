//SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.17;

import "../interfaces/IHasher.sol";
import "../interfaces/IHasherExt.sol";
import "../interfaces/IPoseidon.sol";
import "../interfaces/IPoseidonExt.sol";

contract PoseidonHasherT3 is IHasherT3 {
    IPoseidonT3 public poseidonT3;

    constructor(address _poseidonT3) {
        poseidonT3 = IPoseidonT3(_poseidonT3);
    }

    function hash(
        uint256[2] memory elems
    ) external view override returns (uint256) {
        return poseidonT3.poseidon(elems);
    }
}

contract PoseidonHasherT4 is IHasherT4 {
    IPoseidonT4 public poseidonT4;

    constructor(address _poseidonT4) {
        poseidonT4 = IPoseidonT4(_poseidonT4);
    }

    function hash(
        uint256[3] memory elems
    ) external view override returns (uint256) {
        return poseidonT4.poseidon(elems);
    }
}

contract PoseidonHasherT5 is IHasherT5 {
    IPoseidonT5 public poseidonT5;

    constructor(address _poseidonT5) {
        poseidonT5 = IPoseidonT5(_poseidonT5);
    }

    function hash(
        uint256[4] memory elems
    ) external view override returns (uint256) {
        return poseidonT5.poseidon(elems);
    }
}

contract PoseidonHasherT6 is IHasherT6 {
    IPoseidonT6 public poseidonT6;

    constructor(address _poseidonT6) {
        poseidonT6 = IPoseidonT6(_poseidonT6);
    }

    function hash(
        uint256[5] memory elems
    ) external view override returns (uint256) {
        return poseidonT6.poseidon(elems);
    }
}

contract PoseidonHasherT7 is IHasherT7 {
    IPoseidonT7 public poseidonT7;

    constructor(address _poseidonT7) {
        poseidonT7 = IPoseidonT7(_poseidonT7);
    }

    function hash(
        uint256[6] memory elems
    ) external view override returns (uint256) {
        return poseidonT7.poseidon(elems);
    }
}

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
