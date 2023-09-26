//SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.17;

interface IHasherExtT3 {
    function hash(
        uint256 initialState,
        uint256[2] memory _elems
    ) external view returns (uint256);
}

interface IHasherExtT4 {
    function hash(
        uint256 initialState,
        uint256[3] memory _elems
    ) external view returns (uint256);
}

interface IHasherExtT7 {
    function hash(
        uint256 initialState,
        uint256[6] memory _elems
    ) external view returns (uint256);
}
