//SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.17;

import "../../libs/Types.sol";
import {DepositManagerBase} from "../../DepositManagerBase.sol";

contract TestDepositManagerBase is DepositManagerBase {
    constructor(
        string memory contractName,
        string memory contractVersion
    ) DepositManagerBase(contractName, contractVersion) {}

    function recoverDepositRequestSig(
        DepositRequest calldata req,
        bytes calldata signature
    ) public view returns (address) {
        return _recoverDepositRequestSig(req, signature);
    }
}
