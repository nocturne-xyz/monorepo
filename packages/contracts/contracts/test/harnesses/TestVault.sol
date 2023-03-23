//SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.17;

import "../../libs/Types.sol";
import {Vault} from "../../Vault.sol";

contract TestVault is Vault {
    function initialize(address handler) external initializer {
        __Vault_init(handler);
    }
}
