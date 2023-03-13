//SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.17;

import "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";
import "../../libs/Types.sol";
import {DepositManagerBase} from "../../DepositManagerBase.sol";

interface ITestDepositManagerBase {
    function recoverDepositRequestSig(
        DepositRequest calldata req,
        bytes calldata signature
    ) external view returns (address);
}

contract TestDepositManagerBase is ITestDepositManagerBase, DepositManagerBase {
    function initialize(
        string memory contractName,
        string memory contractVersion
    ) external initializer {
        __DepositManagerBase_initialize(contractName, contractVersion);
    }

    function recoverDepositRequestSig(
        DepositRequest calldata req,
        bytes calldata signature
    ) external view override returns (address) {
        return _recoverDepositRequestSig(req, signature);
    }

    function nameHash() public view returns (bytes32) {
        return _EIP712NameHash();
    }

    function versionHash() public view returns (bytes32) {
        return _EIP712VersionHash();
    }
}
