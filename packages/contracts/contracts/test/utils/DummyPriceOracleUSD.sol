//SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.17;

import {IPriceOracleUSD} from "../../interfaces/IPriceOracleUSD.sol";

contract DummyPriceOracleUSD is IPriceOracleUSD {
    uint256 dummyPrice = 1;

    function getLatestPriceUSD(
        address // token
    ) external view override returns (uint256) {
        return dummyPrice;
    }
}
