// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.17;

interface IWeth {
    function deposit() external payable;

    function withdraw(uint wad) external;

    function approve(address guy, uint256 wad) external;
}
