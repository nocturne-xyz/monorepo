// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.17;

import {IPriceOracleUSD} from "../interfaces/IPriceOracleUSD.sol";
import {FeedRegistryInterface} from "@chainlink/contracts/src/v0.8/interfaces/FeedRegistryInterface.sol";
import {Denominations} from "@chainlink/contracts/src/v0.8/Denominations.sol";

contract ChainlinkPriceOracleUSD is IPriceOracleUSD {
    FeedRegistryInterface public _feedRegistry;

    constructor(address feedRegistry) {
        _feedRegistry = FeedRegistryInterface(feedRegistry);
    }

    function getLatestPriceUSD(address token) external view returns (uint256) {
        (, int price, , , ) = _feedRegistry.latestRoundData(
            token,
            Denominations.USD
        );
        require(price > 0, "!negative price");

        return uint256(price);
    }
}
