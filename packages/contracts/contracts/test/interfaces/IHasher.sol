//SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

interface IHasherT3 {
    function hash(uint256[2] memory _elems) external view returns (uint256);
}

interface IHasherT4 {
    function hash(uint256[3] memory _elems) external view returns (uint256);
}

interface IHasherT5 {
    function hash(uint256[4] memory _elems) external view returns (uint256);
}

interface IHasherT6 {
    function hash(uint256[5] memory _elems) external view returns (uint256);
}

interface IHasherT7 {
    function hash(uint256[6] memory _elems) external view returns (uint256);
}
