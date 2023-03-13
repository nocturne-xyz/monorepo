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

contract TestDepositManagerBase is DepositManagerBase {
    function initialize(
        uint256 chainId,
        string memory contractName,
        string memory contractVersion
    ) external initializer {
        __DepositManagerBase_initialize(chainId, contractName, contractVersion);
    }

    function getMockedDomainSeparator(
        address mockContractAddress
    ) internal view returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    EIP712DOMAIN_TYPEHASH,
                    keccak256(bytes(_contractName)),
                    keccak256(bytes(_contractVersion)),
                    bytes32(_chainId),
                    address(mockContractAddress)
                )
            );
    }

    function recoverDepositRequestSigWithMockedAddress(
        address mockContractAddress,
        DepositRequest calldata req,
        bytes calldata signature
    ) public view returns (address) {
        bytes32 domainSeparator = getMockedDomainSeparator(mockContractAddress);
        bytes32 structHash = _hashDepositRequest(req);

        bytes32 digest = ECDSAUpgradeable.toTypedDataHash(
            domainSeparator,
            structHash
        );

        return ECDSAUpgradeable.recover(digest, signature);
    }
}
