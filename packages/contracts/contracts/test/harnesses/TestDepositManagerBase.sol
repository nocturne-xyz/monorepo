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
    constructor(
        uint256 chainId,
        string memory contractName,
        string memory contractVersion
    ) DepositManagerBase(chainId, contractName, contractVersion) {}

    function getMockedDomainSeparator(
        address mockContractAddress
    ) internal view returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    EIP712DOMAIN_TYPEHASH,
                    keccak256(bytes(CONTRACT_NAME)),
                    keccak256(bytes(CONTRACT_VERSION)),
                    bytes32(CHAIN_ID),
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

    function getDomainSeparator() public view returns (bytes32) {
        return _getDomainSeparator();
    }

    function getDigestWithMockedAddress(
        address mockContractAddress,
        DepositRequest calldata req
    ) public view returns (bytes32) {
        bytes32 domainSeparator = getMockedDomainSeparator(mockContractAddress);
        bytes32 structHash = _hashDepositRequest(req);

        return ECDSAUpgradeable.toTypedDataHash(domainSeparator, structHash);
    }
}
