//SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.17;

interface IPriceOracleUSD {
    function getLatestPriceUSD(address token) external view returns (uint256);
}
