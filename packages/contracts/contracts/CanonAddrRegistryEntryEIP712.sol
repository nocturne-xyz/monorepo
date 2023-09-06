// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

// External
import {ECDSAUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {EIP712Upgradeable} from "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
// Internal
import {Utils} from "./libs/Utils.sol";
import "./libs/Types.sol";

contract CanonAddrRegistryEntryEIP712 is EIP712Upgradeable {
    uint256 constant MODULUS_252 = 2 ** 252;
    bytes32 public constant CANON_ADDR_REGISTRY_ENTRY_TYPEHASH =
        keccak256(
            bytes(
                "CanonAddrRegistryEntry(address ethAddress,uint256 perCanonAddrNonce)"
            )
        );

    function __OperationEIP712_init(
        string memory contractName,
        string memory contractVersion
    ) internal onlyInitializing {
        __EIP712_init(contractName, contractVersion);
    }

    function _computeDigest(
        CanonAddrRegistryEntry calldata entry
    ) public view returns (uint256) {
        bytes32 domainSeparator = _domainSeparatorV4();
        bytes32 structHash = _hashCanonAddrRegistryEntry(entry);

        bytes32 digest = ECDSAUpgradeable.toTypedDataHash(
            domainSeparator,
            structHash
        );

        // mod digest by 2^252 to fit compressed addr sign bit in 253rd PI bit
        return uint256(digest) % MODULUS_252;
    }

    function _hashCanonAddrRegistryEntry(
        CanonAddrRegistryEntry calldata entry
    ) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    CANON_ADDR_REGISTRY_ENTRY_TYPEHASH,
                    entry.ethAddress,
                    entry.perCanonAddrNonce
                )
            );
    }
}
