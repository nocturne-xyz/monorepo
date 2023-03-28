// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

// External
import {ECDSAUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {EIP712Upgradeable} from "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
// Internal
import "./libs/Types.sol";

abstract contract DepositManagerBase is EIP712Upgradeable {
    bytes32 public constant DEPOSIT_REQUEST_TYPEHASH =
        keccak256(
            bytes(
                // solhint-disable-next-line max-line-length
                "DepositRequest(uint256 chainId,address spender,EncodedAsset encodedAsset,uint256 value,StealthAddress depositAddr,uint256 nonce,uint256 gasCompensation)EncodedAsset(uint256 encodedAssetAddr,uint256 encodedAssetId)StealthAddress(uint256 h1X,uint256 h1Y,uint256 h2X,uint256 h2Y)"
            )
        );

    bytes32 public constant ENCODED_ASSET_TYPEHASH =
        keccak256(
            // solhint-disable-next-line max-line-length
            "EncodedAsset(uint256 encodedAssetAddr,uint256 encodedAssetId)"
        );

    bytes32 public constant STEALTH_ADDRESS_TYPEHASH =
        keccak256(
            // solhint-disable-next-line max-line-length
            "StealthAddress(uint256 h1X,uint256 h1Y,uint256 h2X,uint256 h2Y)"
        );

    function __DepositManagerBase_init(
        string memory contractName,
        string memory contractVersion
    ) internal onlyInitializing {
        __EIP712_init(contractName, contractVersion);
    }

    function _recoverDepositRequestSigner(
        DepositRequest calldata req,
        bytes calldata signature
    ) internal view returns (address) {
        bytes32 digest = _computeDigest(req);
        return ECDSAUpgradeable.recover(digest, signature);
    }

    function _computeDigest(
        DepositRequest calldata req
    ) public view returns (bytes32) {
        bytes32 domainSeparator = _domainSeparatorV4();
        bytes32 structHash = _hashDepositRequest(req);

        return ECDSAUpgradeable.toTypedDataHash(domainSeparator, structHash);
    }

    function _hashDepositRequest(
        DepositRequest memory req
    ) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    DEPOSIT_REQUEST_TYPEHASH,
                    req.chainId,
                    req.spender,
                    _hashEncodedAsset(req.encodedAsset),
                    req.value,
                    _hashStealthAddress(req.depositAddr),
                    req.nonce,
                    req.gasCompensation
                )
            );
    }

    function _hashEncodedAsset(
        EncodedAsset memory encodedAsset
    ) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    ENCODED_ASSET_TYPEHASH,
                    encodedAsset.encodedAssetAddr,
                    encodedAsset.encodedAssetId
                )
            );
    }

    function _hashStealthAddress(
        StealthAddress memory stealthAddress
    ) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    STEALTH_ADDRESS_TYPEHASH,
                    stealthAddress.h1X,
                    stealthAddress.h1Y,
                    stealthAddress.h2X,
                    stealthAddress.h2Y
                )
            );
    }
}
