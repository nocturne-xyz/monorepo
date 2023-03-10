// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "./libs/Types.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";

abstract contract DepositManagerBase {
    string public _contractName;
    string public _contractVersion;

    bytes32 public constant DEPOSIT_REQUEST_TYPEHASH =
        keccak256(
            bytes(
                // solhint-disable-next-line max-line-length
                "DepositRequest(uint256 chainId,address spender,EncodedAsset encodedAsset,uint256 value,StealthAddress depositAddr,uint256 nonce,uint256 gasPrice)EncodedAsset(uint256 encodedAssetAddr,uint256 encodedAssetId)StealthAddress(uint256 h1X,uint256 h1Y,uint256 h2X,uint256 h2Y)"
            )
        );
    bytes32 public constant ENCODED_ASSET_TYPEHASH =
        keccak256(
            bytes(
                // solhint-disable-next-line max-line-length
                "EncodedAsset(uint256 encodedAssetAddr,uint256 encodedAssetId)"
            )
        );
    bytes32 public constant STEALTH_ADDRESS_TYPEHASH =
        keccak256(
            bytes(
                // solhint-disable-next-line max-line-length
                "StealthAddress(uint256 h1X,uint256 h1Y,uint256 h2X,uint256 h2Y)"
            )
        );

    // solhint-disable-next-line max-line-length
    string public constant EIP712_DOMAIN_TYPE =
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)";

    constructor(string memory contractName, string memory contractVersion) {
        _contractName = contractName;
        _contractVersion = contractVersion;
    }

    function _getDomainSeparator(
        uint256 chainId
    ) internal view returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    keccak256(bytes(EIP712_DOMAIN_TYPE)),
                    keccak256(bytes(_contractName)),
                    keccak256(bytes(_contractVersion)),
                    bytes32(chainId),
                    address(0x1111111111111111111111111111111111111111)
                )
            );
    }

    function _recoverDepositRequestSig(
        DepositRequest calldata req,
        bytes calldata signature
    ) internal view returns (address) {
        bytes32 domainSeparator = _getDomainSeparator(req.chainId);

        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                domainSeparator,
                _hashDepositRequest(req)
            )
        );

        return ECDSAUpgradeable.recover(digest, signature);
    }

    function _hashDepositRequest(
        DepositRequest calldata req
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
                    req.gasPrice
                )
            );
    }

    function _hashEncodedAsset(
        EncodedAsset calldata encodedAsset
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
        StealthAddress calldata stealthAddress
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
