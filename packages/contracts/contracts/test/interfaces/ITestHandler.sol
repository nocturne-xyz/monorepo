//SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {IHandler} from "../../interfaces/IHandler.sol";

interface ITestHandler is IHandler {
    function _nullifierSet(uint256 nf) external view returns (bool);
}
