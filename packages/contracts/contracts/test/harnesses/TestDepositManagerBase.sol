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
    constructor(
        uint256 chainId,
        string memory contractName,
        string memory contractVersion
    ) DepositManagerBase(chainId, contractName, contractVersion) {}

    function recoverDepositRequestSig(
        DepositRequest calldata req,
        bytes calldata signature
    ) public view override returns (address) {
        return _recoverDepositRequestSig(req, signature);
    }

    function getDomainSeparator() public view returns (bytes32) {
        return _getDomainSeparator();
    }

    function getDigest(
        DepositRequest calldata req
    ) public view returns (bytes32) {
        bytes32 domainSeparator = _getDomainSeparator();
        bytes32 structHash = _hashDepositRequest(req);

        return ECDSAUpgradeable.toTypedDataHash(domainSeparator, structHash);
    }
}
